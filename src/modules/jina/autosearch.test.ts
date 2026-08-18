/// <reference types="node" />

// Unit tests for the auto-search query builder (follow-up handling).
// Run: NODE_ENV=development npx tsx --test src/modules/jina/autosearch.test.ts

import assert from 'node:assert';
import { describe, it } from 'node:test';

import { buildSearchQuery, cleanFetchedMarkdown } from './autosearch.query';


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
