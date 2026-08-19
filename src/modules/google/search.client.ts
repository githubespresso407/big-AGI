import { apiAsync } from '~/common/util/trpc.client';

import { isValidJinaApiKey, useJinaStore } from '~/modules/jina/store-module-jina';
import { isValidExaApiKey, useExaStore } from '~/modules/exa/store-module-exa'; // [Exa patch]

import { Search } from './search.types';
import { useGoogleSearchStore } from './store-module-google';


export const isValidGoogleCloudApiKey = (apiKey?: string) => !!apiKey && apiKey.trim()?.length >= 39;
export const isValidGoogleCseId = (cseId?: string) => !!cseId && cseId.trim()?.length >= 17;


/**
 * This function either returns the Search JSON response, or throws a descriptive error string
 */
export async function callApiSearchGoogle(query: string, items: number, restrictToDomain?: string): Promise<{ pages: Search.API.BriefResult[] }> {

  // get the keys (empty if they're on server)
  const { googleCloudApiKey, googleCSEId, restrictToDomain: defaultRestrictToDomain } = useGoogleSearchStore.getState();
  const { jinaApiKey } = useJinaStore.getState();
  const { exaApiKey } = useExaStore.getState(); // [Exa patch]

  // [Jina patch]/[Exa patch] route to Exa/Jina Search when Google PSE isn't configured client-side;
  // when no client keys are set, the server decides (env fallback: Google -> EXA_API_KEY -> JINA_API_KEY).
  // Note: a client-set Jina key no longer forces 'jina' - it's passed along and the server applies the
  // same precedence, so a server-side EXA_API_KEY still wins for search.
  const hasGoogle = isValidGoogleCloudApiKey(googleCloudApiKey) && isValidGoogleCseId(googleCSEId);
  const hasExa = isValidExaApiKey(exaApiKey);
  const provider = hasGoogle ? 'google' : hasExa ? 'exa' : 'google';

  try {
    return await apiAsync.googleSearch.search.query({
      query,
      items,
      provider,
      key: googleCloudApiKey,
      cx: googleCSEId,
      ...(!!jinaApiKey.trim() && { jinaKey: jinaApiKey.trim() }),
      ...(hasExa && { exaKey: exaApiKey.trim() }),
      restrictToDomain: restrictToDomain || defaultRestrictToDomain || null,
    });
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    console.error(`callApiSearchGoogle: ${errorMessage}`);
    throw new Error(errorMessage);
  }
}