import { create } from 'zustand';
import { persist } from 'zustand/middleware';


/**
 * [Jina patch] Shared Jina AI (Reader r.jina.ai / Search s.jina.ai) settings.
 * Single key, consumed by both the Browse module (browse-jina dialect) and
 * the Search module (jina provider). Server-side equivalent: JINA_API_KEY env.
 */

// [Jina patch] auto-search mode: 'off' | 'auto' (an LLM gate decides per message and rewrites the query) | 'always' (every message)
export type AutoSearchMode = 'off' | 'auto' | 'always';

interface ModuleJinaStore {

  jinaApiKey: string;
  setJinaApiKey: (apiKey: string) => void;

  // [Jina patch] auto-search: augment outgoing chat messages with web results
  autoSearchMode: AutoSearchMode;
  setAutoSearchMode: (mode: AutoSearchMode) => void;

}

export const useJinaStore = create<ModuleJinaStore>()(
  persist(
    (set) => ({

      jinaApiKey: '',
      setJinaApiKey: (jinaApiKey: string) => set({ jinaApiKey }),

      autoSearchMode: 'off',
      setAutoSearchMode: (autoSearchMode: AutoSearchMode) => set({ autoSearchMode }),

    }),
    {
      name: 'app-module-jina',
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // v0 -> v1: autoSearchEnabled (boolean) -> autoSearchMode ('always' preserved the old behavior)
        if (version === 0 && persistedState && typeof persistedState === 'object') {
          persistedState.autoSearchMode = persistedState.autoSearchEnabled ? 'always' : 'off';
          delete persistedState.autoSearchEnabled;
        }
        return persistedState;
      },
    },
  ),
);

// Jina keys look like 'jina_xxxxxxxx...'; be lenient on length, strict on prefix
export const isValidJinaApiKey = (apiKey?: string) => !!apiKey && apiKey.trim().startsWith('jina_') && apiKey.trim().length >= 10;
