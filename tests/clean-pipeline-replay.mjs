// Replays URLs through the auto-search cleaning pipeline (cleanFetchedMarkdown
// equivalent + the 3500-char budget) and reports content density.
//
// Usage:
//   node tests/clean-pipeline-replay.mjs                  # default sample pages
//   node tests/clean-pipeline-replay.mjs <url1> <url2>    # your own pages

const DEFAULT_URLS = [
  'https://en.wikipedia.org/wiki/Retrieval-augmented_generation',
  'https://example.com',
];

const URLS = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_URLS;
const BUDGET = 3500;

// NOTE: keep in sync with src/modules/jina/autosearch.query.ts::cleanFetchedMarkdown
function cleanFetchedMarkdown(markdown) {
  return markdown
    .replace(/\[?\s*!\[[^\]]*\]\([^)]*\)\s*\]?(\([^)]*\))?/g, '')
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1')
    .split('\n').map(l => l.trim())
    .filter(l => l && !/^[*\-|\s•·>]+$/.test(l))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

for (const url of URLS) {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'application/json', 'X-Return-Format': 'markdown' },
      signal: AbortSignal.timeout(45000),
    });
    const env = await res.json();
    const raw = env?.data?.content || '';
    const clean = cleanFetchedMarkdown(raw).slice(0, BUDGET);
    const linkChars = (clean.match(/https?:\/\/[^)\s]+/g) || []).join('').length;
    console.log(`\n===== ${url}`);
    console.log(`raw: ${raw.length} chars -> cleaned+budgeted: ${clean.length} chars (residual URL chars: ${linkChars})`);
    console.log('--- first 300 chars ---');
    console.log(clean.slice(0, 300));
  } catch (e) {
    console.log(`\n===== ${url}\nFETCH FAILED: ${e.message}`);
  }
}
