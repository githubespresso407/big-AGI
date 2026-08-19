import assert from 'node:assert';
import { test } from 'node:test';
import { exaBuildSearchRequest, exaMapSearchResponse } from './exa-search';

test('request: auto type, highlights contents, trimmed query', () => {
  const body: any = exaBuildSearchRequest('  solar news  ', 5, null);
  assert.equal(body.query, 'solar news');
  assert.equal(body.type, 'auto');
  assert.equal(body.numResults, 5);
  assert.ok(body.contents.highlights);
  assert.equal(body.includeDomains, undefined);
});

test('request: domain restriction maps to includeDomains', () => {
  const body: any = exaBuildSearchRequest('q', 3, ' wikipedia.org ');
  assert.deepEqual(body.includeDomains, ['wikipedia.org']);
});

test('response: maps results and prefers highlights for the snippet', () => {
  const pages = exaMapSearchResponse({
    results: [
      { title: 'T1', url: 'https://a.com', highlights: ['first sentence.', 'second sentence.'], text: 'long text' },
      { title: 'T2', url: 'https://b.com', text: 'fallback text' },
      { url: 'https://c.com' },
    ],
  }, 10);
  assert.ok(pages);
  assert.equal(pages.length, 3);
  assert.deepEqual(pages[0], { title: 'T1', link: 'https://a.com', snippet: 'first sentence. … second sentence.' });
  assert.equal(pages[1].snippet, 'fallback text');
  assert.equal(pages[2].snippet, '');
});

test('response: respects maxItems', () => {
  const pages = exaMapSearchResponse({ results: [
    { title: '1', url: 'https://1.com' }, { title: '2', url: 'https://2.com' },
  ] }, 1);
  assert.equal(pages?.length, 1);
});

test('response: error shape maps to null', () => {
  assert.equal(exaMapSearchResponse({ error: 'Invalid API key' }, 10), null);
  assert.equal(exaMapSearchResponse({}, 10), null);
});
