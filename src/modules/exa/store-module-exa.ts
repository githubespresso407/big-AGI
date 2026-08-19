// [Exa patch] Exa API key store (mirrors store-module-jina)
import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// Exa API keys are UUID-shaped (e.g. 00000000-0000-0000-0000-000000000000)
export const isValidExaApiKey = (apiKey?: string) => !!apiKey && apiKey.trim().length >= 32;


interface ModuleExaStore {

  exaApiKey: string;
  setExaApiKey: (apiKey: string) => void;

}

export const useExaStore = create<ModuleExaStore>()(
  persist(
    (set) => ({

      exaApiKey: '',
      setExaApiKey: (exaApiKey: string) => set({ exaApiKey }),

    }),
    {
      name: 'app-module-exa',
    },
  ),
);
