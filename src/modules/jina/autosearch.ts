import { isTextContentFragment } from '~/common/stores/chat/chat.fragments';
import type { DMessage } from '~/common/stores/chat/chat.message';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';

import { getDomainModelIdOrThrow } from '~/common/stores/llms/store-llms';

import { aixChatGenerateText_Simple } from '~/modules/aix/client/aix.client';
import { callBrowseFetchPageOrThrow } from '~/modules/browse/browse.client';
import { callApiSearchGoogle } from '~/modules/google/search.client';

import { useJinaStore } from './store-module-jina';
import type { SearchGateTurn } from './autosearch.query';
import { buildSearchGatePrompts, buildSearchQuery, cleanFetchedMarkdown, parseSearchGateResponse } from './autosearch.query';


/**
 * [Jina patch] Auto-search: outgoing user messages can be augmented with fresh web
 * search results before the model sees them - plain chat gains "search the internet
 * when needed" behavior without /react.
 *
 * Modes (composer Web button / Google Search settings):
 * - off: messages are sent untouched
 * - auto: a fast LLM gate sees the recent conversation and decides whether a search
 *   is needed; if so it rewrites the message into a standalone query ("when will it
 *   be released?" -> "Dune Part Three release date")
 * - always: every message is searched, with the same LLM-based query rewrite
 *
 * If the gate model is unavailable or fails, falls back to the heuristic query
 * builder (previous user message folded in for follow-ups) and searches anyway.
 * Fails open: any search/browse error returns the original text untouched.
 */

// configuration
const AUTOSEARCH_RESULT_COUNT = 5;
const AUTOSEARCH_PAGE_MAX_CHARS = 3500; // generous: nav clutter is stripped first, and data often sits deep in the page
const GATE_HISTORY_TURNS = 6;
const GATE_TURN_MAX_CHARS = 400;

/** Extracts plain text from the most recent user messages of a conversation (oldest first). */
export function extractPreviousUserTexts(messages: Readonly<DMessage[]>, count: number): string[] {
  const texts: string[] = [];
  for (let i = messages.length - 1; i >= 0 && texts.length < count; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    const text = m.fragments
      .filter(isTextContentFragment)
      .map(f => f.part.text)
      .join('\n')
      .trim();
    if (text) texts.unshift(text);
  }
  return texts;
}

/** Extracts the most recent user+assistant turns (oldest first, each truncated) for the search gate. */
export function extractRecentGateTurns(messages: Readonly<DMessage[]>, count: number): SearchGateTurn[] {
  const turns: SearchGateTurn[] = [];
  for (let i = messages.length - 1; i >= 0 && turns.length < count; i--) {
    const m = messages[i];
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    let text = messageFragmentsReduceText(m.fragments).trim();
    if (!text) continue;
    if (text.length > GATE_TURN_MAX_CHARS)
      text = text.slice(0, GATE_TURN_MAX_CHARS) + '...';
    turns.unshift({ role: m.role, text });
  }
  return turns;
}

/**
 * Returns the user text, possibly prefixed with a web-search context block.
 * Fails open: any gate/search/browse error returns the original text untouched.
 */
export async function augmentTextWithWebSearch(
  userText: string,
  priorMessages: Readonly<DMessage[]>,
  conversationId: string,
  onStatus?: (message: string) => void,
): Promise<string> {

  const mode = useJinaStore.getState().autoSearchMode;
  if (mode === 'off' || !userText.trim())
    return userText;

  const forceSearch = mode === 'always';

  // decide the query: LLM gate (decides + rewrites standalone), heuristic builder as fallback
  let query: string | null = null;
  try {
    const gateLlmId = getDomainModelIdOrThrow(['fastUtil'], false, false, 'search-gate');
    onStatus?.(forceSearch ? 'Preparing the web search...' : 'Deciding if a web search is needed...');
    const gateTurns = extractRecentGateTurns(priorMessages, GATE_HISTORY_TURNS);
    const { system, user } = buildSearchGatePrompts(gateTurns, userText, forceSearch);
    const gateOutput = await aixChatGenerateText_Simple(gateLlmId, system, user, 'chat-search-gate', conversationId);
    const decision = parseSearchGateResponse(gateOutput, forceSearch);
    if (!decision.search) {
      onStatus?.('No web search needed');
      return userText;
    }
    query = decision.query; // may be null -> heuristic below
  } catch (error) {
    console.warn('[DEV] autosearch: gate unavailable, falling back to heuristic query:', error);
    if (!forceSearch)
      onStatus?.('Search gate unavailable - searching anyway');
  }
  if (!query)
    query = buildSearchQuery(userText, extractPreviousUserTexts(priorMessages, 2));

  const queryPreview = query.length > 60 ? query.slice(0, 60) + '…' : query;

  try {
    onStatus?.(`Searching the web: "${queryPreview}"`);

    // routes to Exa/Jina Search when Google PSE isn't configured (see search.client.ts)
    const { pages } = await callApiSearchGoogle(query, AUTOSEARCH_RESULT_COUNT + 2);
    const top = pages.filter(p => p.link?.startsWith('http')).slice(0, AUTOSEARCH_RESULT_COUNT);
    if (!top.length)
      return userText;

    // fetch each page via the browse backend (Jina Reader) in parallel; fall back to the snippet
    const sections = await Promise.all(top.map(async (p, index) => {
      let body = p.snippet || '';
      try {
        const page = await callBrowseFetchPageOrThrow(p.link, ['markdown']);
        const markdown = page.content?.markdown || page.content?.text || '';
        if (markdown.trim())
          body = cleanFetchedMarkdown(markdown).slice(0, AUTOSEARCH_PAGE_MAX_CHARS).trim();
      } catch {
        // keep the snippet
      }
      return `[${index + 1}] ${p.title}\n${p.link}\n${body}`;
    }));

    onStatus?.(`Web results ready (${top.length} sources)`);

    return [
      `<web_search_results query="${query.replace(/"/g, '\'')}">`,
      sections.join('\n\n'),
      `</web_search_results>`,
      '',
      'Answer the following using the web search results above when relevant. Cite sources by their [number]. If the results are not relevant to the question, answer from your own knowledge.',
      '',
      userText,
    ].join('\n');

  } catch (error: any) {
    console.warn('[DEV] autosearch: failed, sending without results:', error);
    onStatus?.('Web search unavailable - sending without results');
    return userText;
  }
}
