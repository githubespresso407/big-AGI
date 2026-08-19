// [Exa patch] pure logic for the Exa search provider - import-free for tsx --test

export const EXA_SEARCH_ENDPOINT = 'https://api.exa.ai/search';

export interface ExaWireResult {
  title?: string;
  url?: string;
  highlights?: string[];
  text?: string;
}

export interface ExaWireResponse {
  results?: ExaWireResult[];
  error?: string;
}

export interface ExaBriefResult {
  title: string;
  link: string;
  snippet: string;
}

/**
 * Builds the POST body for https://exa.ai/docs/reference/search
 * - type 'auto': Exa picks neural vs keyword per query
 * - highlights: short query-relevant extracts - mapped to BriefResult.snippet
 * - domain restriction maps natively to includeDomains (no site: string hack)
 */
export function exaBuildSearchRequest(query: string, numResults: number, restrictToDomain?: string | null): object {
  return {
    query: query.trim(),
    type: 'auto',
    numResults,
    ...(restrictToDomain?.trim() && { includeDomains: [restrictToDomain.trim()] }),
    contents: {
      highlights: { numSentences: 2, highlightsPerUrl: 2 },
    },
  };
}

/**
 * Maps the Exa response to the router's { title, link, snippet } contract.
 * Returns null when Exa reported an error or returned no results array.
 */
export function exaMapSearchResponse(data: ExaWireResponse, maxItems: number): ExaBriefResult[] | null {
  if (!data.results)
    return null;
  return data.results.slice(0, maxItems).map((r): ExaBriefResult => ({
    title: r.title || '',
    link: r.url || '',
    snippet: (r.highlights?.filter(Boolean).join(' … ') || r.text || '').trim(),
  }));
}
