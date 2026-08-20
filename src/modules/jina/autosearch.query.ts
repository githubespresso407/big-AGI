/**
 * [Jina patch] Pure query-building logic for auto-search - kept free of runtime
 * imports so it can be unit-tested under plain tsx (see autosearch.test.ts).
 */

// configuration
const AUTOSEARCH_QUERY_MAX_CHARS = 280;

// words that signal the message references earlier context
const FOLLOWUP_HINTS = /\b(it|its|this|that|these|those|they|them|their|his|her|their|the first|the second|the third|that one|this one|what about|how about|also|instead)\b/i;

function _wordCount(s: string): number {
  return s.trim().split(/\s+/).length;
}

/**
 * Builds the search query from the current message, folding in the previous user
 * message when the current one looks like a follow-up (short, or uses references
 * like "it"/"that one"/"what about").
 */
export function buildSearchQuery(currentMessage: string, previousUserMessages: string[]): string {
  const current = currentMessage.trim().replace(/\s+/g, ' ');
  const previous = previousUserMessages.map(m => m.trim().replace(/\s+/g, ' ')).filter(Boolean);

  const looksLikeFollowup = previous.length > 0
    && current.length <= 140
    && (FOLLOWUP_HINTS.test(current) || _wordCount(current) <= 7);

  const combined = looksLikeFollowup
    ? `${previous[previous.length - 1]} - ${current}`
    : current;

  return _stripChatFiller(combined).slice(0, AUTOSEARCH_QUERY_MAX_CHARS);
}

// conversational scaffolding that dilutes search queries
const CHAT_FILLER_PREFIX = /^(please\s+)?((can|could|would)\s+you\s+)?(get|tell|find|show|give|look\s+up)\s+(me\s+)?/i;

function _stripChatFiller(query: string): string {
  return query.replace(CHAT_FILLER_PREFIX, '').trim();
}


// --- search gate: an LLM decides IF a search is needed and rewrites the query standalone ---

export interface SearchGateTurn {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * Gate decision from parseSearchGateResponse:
 * - search: false -> send the message untouched
 * - search: true, query: string -> search with this query
 * - search: true, query: null -> search, but the gate produced no usable query (use the heuristic builder)
 */
export type SearchGateDecision =
  | { search: false }
  | { search: true, query: string | null };

export const SEARCH_GATE_SYSTEM_PROMPT =
  'You are a web search gate for a chat assistant. You never answer questions - you only decide whether a live web search is needed, and if so you write the search query. You are terse and follow the output format exactly.';

/**
 * Builds the (system, user) prompt pair for the gate LLM.
 * forceSearch = true removes the NO_SEARCH option (composer Web: Always mode) - the gate
 * then only rewrites the message into a standalone query.
 */
export function buildSearchGatePrompts(turns: SearchGateTurn[], latestUserMessage: string, forceSearch: boolean): { system: string, user: string } {

  const transcript = turns
    .filter(t => t.text.trim())
    .map(t => `${t.role === 'user' ? 'User' : 'Assistant'}: ${t.text.trim()}`)
    .join('\n');

  const decisionRules = forceSearch
    ? `A web search will run for the user's latest message. Write the best search query for it.`
    : `Decide whether a live web search is needed to answer the user's latest message.
Search only for current, recent, or time-sensitive facts (news, weather, prices, releases, dates, scores, availability) or specific facts the assistant may not reliably know. Do not search for general knowledge, explanations, opinions, creative writing, coding, math, or casual conversation.`;

  const outputFormat = forceSearch
    ? `Reply with exactly one line:
SEARCH: <query>`
    : `Reply with exactly one line:
NO_SEARCH - if no search is needed
SEARCH: <query> - if a search is needed`;

  const user = `${decisionRules}

The <query> must be fully standalone: rewrite the user's message so the query carries the subject. Resolve every reference (it, this, that, they, the movie, the first one, ...) to what it points to in the conversation. Keep it under 15 words. Never answer the question itself.

Conversation so far (truncated):
${transcript || '(no prior messages)'}

Latest user message:
${latestUserMessage.trim()}

${outputFormat}`;

  return { system: SEARCH_GATE_SYSTEM_PROMPT, user };
}

/**
 * Parses the gate LLM output. Lenient about case/whitespace/quote wrapping.
 * forceSearch: unrecognized output means "search with heuristic query" instead of "no search".
 */
export function parseSearchGateResponse(output: string, forceSearch: boolean): SearchGateDecision {
  const text = (output || '').trim();
  if (!text)
    return forceSearch ? { search: true, query: null } : { search: false };

  if (/^no[ _-]?search\b/i.test(text))
    return { search: false };

  const searchMatch = text.match(/^search\s*:\s*(.*)$/is);
  if (searchMatch) {
    const query = searchMatch[1].trim().replace(/^["']+|["']+$/g, '').trim();
    return { search: true, query: query ? query.slice(0, AUTOSEARCH_QUERY_MAX_CHARS) : null };
  }

  // unrecognized output: in force mode still search (heuristic query); otherwise do not hijack the message
  return forceSearch ? { search: true, query: null } : { search: false };
}

/**
 * Reduces Jina Reader markdown to dense plain text: drops image embeds, converts
 * links to their anchor text, removes nav-style link list lines and empty husk lines.
 * This is what lets the char budget hold actual page data instead of navigation.
 */
export function cleanFetchedMarkdown(markdown: string): string {
  return markdown
    // image embeds (incl. linked images)
    .replace(/\[?\s*!\[[^\]]*\]\([^)]*\)\s*\]?(\([^)]*\))?/g, '')
    // links -> anchor text
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1')
    // lines that are now empty or just bullets/separators/table pipes
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !/^[*\-|\s•·>]+$/.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
