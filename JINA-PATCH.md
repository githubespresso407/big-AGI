# Jina Patch (fork-local)

This fork adds Jina AI as a backend for the **Browse** and **Search** tools,
on top of upstream `enricoros/big-AGI`. All changes are marked with
`[Jina patch]` comments.

## What it does

- **Browse**: new `browse-jina` dialect in `browse.router.ts` fetches pages via
  `https://r.jina.ai/<url>` (clean markdown, no Puppeteer browser needed).
  Used automatically when the Puppeteer WSS endpoint is empty. Works without a
  key at Jina's low anonymous rate limit; a key raises it.
- **Search**: new `jina` provider in `google/search.router.ts` uses
  `https://s.jina.ai/<query>` instead of Google Programmable Search.
  Requires an API key. Auto-selected when Google PSE credentials are missing
  but a Jina key exists (client-side store or `JINA_API_KEY` env).
- **Shared key**: one Jina API key field (zustand store `app-module-jina`)
  shown in both the Browse and Search settings panels.
- **Server-wide**: setting the `JINA_API_KEY` env var enables both tools for
  all browsers/devices without entering keys in the UI. Backend capabilities
  (`hasBrowsing`, `hasGoogleCustomSearch`) reflect it.
- **Auto-search** (2nd commit): composer "Web" toggle + Search-settings
  checkbox (`autoSearchEnabled` in the same store). When ON, outgoing chat
  messages are augmented: Jina search -> top 3 pages via Jina Reader ->
  `<web_search_results>` context block prepended to the user text. Follow-up
  messages fold the previous user message into the query
  (`src/modules/jina/autosearch.query.ts`, unit-tested in
  `src/modules/jina/autosearch.test.ts`). Skips image-generation and /react;
  fails open (sends the original text if search errors).

## Files touched

- `src/modules/jina/store-module-jina.ts` (new)
- `src/modules/jina/autosearch.ts` / `autosearch.query.ts` / `autosearch.test.ts` (new)
- `src/apps/chat/components/composer/Composer.tsx` (send-path hook + toggle)
- `src/apps/chat/components/composer/buttons/ButtonAutoSearch.tsx` (new)
- `src/server/env.server.ts` (`JINA_API_KEY`)
- `src/modules/backend/backend.router.ts` (capabilities)
- `src/modules/browse/{browse.router.ts,browse.client.ts,store-module-browsing.tsx,BrowseSettings.tsx}`
- `src/modules/google/{search.router.ts,search.client.ts,GoogleSearchSettings.tsx}`
- `tests/jina-patch.test.mjs` (new; run: `node tests/jina-patch.test.mjs`)

## Revert

```bash
git reset --hard pre-jina-restore
git push --force origin main   # Vercel redeploys upstream state
```

## Syncing upstream

```bash
git remote add upstream https://github.com/enricoros/big-AGI.git   # once
git fetch upstream
git merge upstream/main    # conflicts unlikely: all hunks are additive & marked
git push origin main
```

If upstream restructures `browse.router.ts` or `search.router.ts`, re-apply by
searching for `[Jina patch]` in the pre-merge tree.
