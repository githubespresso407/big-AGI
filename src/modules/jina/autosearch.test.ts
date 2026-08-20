/// <reference types="node" />

// Unit tests for the auto-search query builder (follow-up handling).
// Run: NODE_ENV=development npx tsx --test src/modules/jina/autosearch.test.ts

import assert from 'node:assert';
import { describe, it } from 'node:test';

import { buildSearchGatePrompts, buildSearchQuery, cleanFetchedMarkdown, parseSearchGateResponse } from './autosearch.query';


describe('buildSearchQuery', () => {

  it('uses the message verbatim for a standalone first question', () => {
    assert.strictEqual(
      buildSearchQuery('who won the 2026 world cup', []),
      'who won the 2026 world cup',
    );
  });

  it('folds in the previous message for deictic follow-ups', () => {
    assert.strictEqual(
      buildSearchQuery('what about the second one?', ['compare the top 3 meal delivery services']),
      'compare the top 3 meal delivery services - what about the second one?',
    );
  });

  it('folds in the previous message for very short follow-ups', () => {
    assert.strictEqual(
      buildSearchQuery('and in Texas?', ['Aetna dietitian licensing requirements']),
      'Aetna dietitian licensing requirements - and in Texas?',
    );
  });

  it('does not fold for long standalone messages with history', () => {
    const longMsg = 'explain the difference between Fenton 2025 and WHO 2006 growth charts for preterm infants in detail';
    assert.strictEqual(buildSearchQuery(longMsg, ['hello']), longMsg);
  });

  it('does not fold when there is no history', () => {
    assert.strictEqual(buildSearchQuery('what about it?', []), 'what about it?');
  });

  it('caps the query length', () => {
    const long = 'x'.repeat(400);
    assert.ok(buildSearchQuery(long, []).length <= 280);
  });

  it('collapses whitespace', () => {
    assert.strictEqual(
      buildSearchQuery('  who   won\n\nthe race  ', []),
      'who won the race',
    );
  });

  it('strips conversational filler from the query', () => {
    assert.strictEqual(
      buildSearchQuery('can you get me the 7 day forecast for Denver, CO?', []),
      'the 7 day forecast for Denver, CO?',
    );
    assert.strictEqual(
      buildSearchQuery('please look up CNSC exam dates', []),
      'CNSC exam dates',
    );
  });

});

describe('buildSearchGatePrompts', () => {

  const turns = [
    { role: 'user' as const, text: 'tell me about Dune Part Three' },
    { role: 'assistant' as const, text: 'Dune Part Three is the upcoming...' },
  ];

  it('offers NO_SEARCH in auto mode and embeds the transcript and latest message', () => {
    const { system, user } = buildSearchGatePrompts(turns, 'when will it be released?', false);
    assert.ok(system.length > 0);
    assert.match(user, /NO_SEARCH/);
    assert.match(user, /SEARCH: <query>/);
    assert.match(user, /User: tell me about Dune Part Three/);
    assert.match(user, /Assistant: Dune Part Three is the upcoming\.\.\./);
    assert.match(user, /Latest user message:\nwhen will it be released\?/);
  });

  it('removes the NO_SEARCH option in force mode', () => {
    const { user } = buildSearchGatePrompts(turns, 'when will it be released?', true);
    assert.ok(!/NO_SEARCH/.test(user));
    assert.match(user, /SEARCH: <query>/);
  });

  it('handles empty history', () => {
    const { user } = buildSearchGatePrompts([], 'weather in Tokyo', false);
    assert.match(user, /\(no prior messages\)/);
  });

});

describe('parseSearchGateResponse', () => {

  it('parses NO_SEARCH in auto mode', () => {
    assert.deepStrictEqual(parseSearchGateResponse('NO_SEARCH', false), { search: false });
    assert.deepStrictEqual(parseSearchGateResponse('no search', false), { search: false });
  });

  it('parses NO_SEARCH even in force mode (model refused)', () => {
    assert.deepStrictEqual(parseSearchGateResponse('NO_SEARCH', true), { search: false });
  });

  it('parses SEARCH with a standalone rewritten query', () => {
    assert.deepStrictEqual(
      parseSearchGateResponse('SEARCH: Dune Part Three release date', false),
      { search: true, query: 'Dune Part Three release date' },
    );
  });

  it('strips quote wrapping around the query', () => {
    assert.deepStrictEqual(
      parseSearchGateResponse('SEARCH: "Dune Part Three release date"', false),
      { search: true, query: 'Dune Part Three release date' },
    );
  });

  it('returns a null query when SEARCH has no query text', () => {
    assert.deepStrictEqual(parseSearchGateResponse('SEARCH:', false), { search: true, query: null });
  });

  it('treats unrecognized output as no-search in auto mode', () => {
    assert.deepStrictEqual(parseSearchGateResponse('It will be released in 2026.', false), { search: false });
    assert.deepStrictEqual(parseSearchGateResponse('', false), { search: false });
  });

  it('treats unrecognized output as search-with-heuristic in force mode', () => {
    assert.deepStrictEqual(parseSearchGateResponse('hmm let me think', true), { search: true, query: null });
    assert.deepStrictEqual(parseSearchGateResponse('', true), { search: true, query: null });
  });

  it('caps the parsed query length', () => {
    const decision = parseSearchGateResponse('SEARCH: ' + 'x'.repeat(400), false);
    assert.ok(decision.search && decision.query && decision.query.length <= 280);
  });

});

describe('cleanFetchedMarkdown', () => {

  it('strips images and converts links to anchor text', () => {
    const md = '![Image 1: logo](https://x.com/logo.png)\n[Forecast](https://x.com/f) for McAllen';
    assert.strictEqual(cleanFetchedMarkdown(md), 'Forecast for McAllen');
  });

  it('drops link-only nav lines down to their text', () => {
    const md = '[Today](https://x.com/t)\n[Hourly](https://x.com/h)\n\nActual content here';
    assert.strictEqual(cleanFetchedMarkdown(md), 'Today\nHourly\nActual content here');
  });

  it('removes empty husk and separator lines', () => {
    const md = 'Header\n*\n|\n-\n\n\n\nBody text';
    assert.strictEqual(cleanFetchedMarkdown(md), 'Header\nBody text');
  });

  it('keeps plain text untouched', () => {
    assert.strictEqual(cleanFetchedMarkdown('just text'), 'just text');
  });

});
