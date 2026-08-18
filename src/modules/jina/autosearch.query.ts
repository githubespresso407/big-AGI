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
