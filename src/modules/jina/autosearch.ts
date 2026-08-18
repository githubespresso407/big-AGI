import type { DMessage } from '~/common/stores/chat/chat.message';
import { isTextContentFragment } from '~/common/stores/chat/chat.fragments';

import { callBrowseFetchPageOrThrow } from '~/modules/browse/browse.client';
import { callApiSearchGoogle } from '~/modules/google/search.client';

import { useJinaStore } from './store-module-jina';
import { buildSearchQuery, cleanFetchedMarkdown } from './autosearch.query';


/**
 * [Jina patch] Auto-search: when enabled (composer globe toggle), outgoing user messages
 * are augmented with fresh web search results before the model sees them - plain chat
 * gains "search the internet when needed" behavior without /react.
 *
 * Follow-ups: short/deictic messages ("what about the cheaper one?") are expanded with
 * the previous user message so the search query carries the conversation subject
 * (see autosearch.query.ts).
 */

// configuration
const AUTOSEARCH_RESULT_COUNT = 3;
const AUTOSEARCH_PAGE_MAX_CHARS = 3500; // generous: nav clutter is stripped first, and data often sits deep in the page

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

/**
 * Returns the user text, possibly prefixed with a web-search context block.
 * Fails open: any search/browse error returns the original text untouched.
 */
export async function augmentTextWithWebSearch(
  userText: string,
  previousUserMessages: string[],
  onStatus?: (message: string) => void,
): Promise<string> {

  if (!useJinaStore.getState().autoSearchEnabled || !userText.trim())
    return userText;

  const query = buildSearchQuery(userText, previousUserMessages);
  const queryPreview = query.length > 60 ? query.slice(0, 60) + '…' : query;

  try {
    onStatus?.(`Searching the web: "${queryPreview}"`);

    // routes to Jina Search when Google PSE isn't configured (see search.client.ts)
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
