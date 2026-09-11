# Word Matcher v2

Adaptive Mandarin vocabulary drills, built as a portrait-first PWA for phones.

This is a from-scratch rewrite of the original `wordmatcher` Create React App. The old app was an
infinite multiple-choice loop with no feedback, no session end and no adaptive pacing; v2 replaces the
loop with a Leitner-box scheduler, makes the answer reveal a designed moment, and ends every session
with a summary and a mistake review.

## Quick start

```sh
npm install
npm run data:build   # compiles data/source/*.ts into public/data/lists/*.json
npm run dev
```

## Scripts

| Script                 | What it does                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| `npm run dev`          | Vite dev server                                                     |
| `npm run build`        | Type-check then build to `dist/`                                    |
| `npm run preview`      | Serve the production build locally                                  |
| `npm run data:build`   | Regenerate `public/data/lists/*.json` from `data/source`            |
| `npm run test`         | Unit tests (Vitest)                                                 |
| `npm run e2e`          | End-to-end tests (Playwright)                                       |
| `npm run typecheck`    | Type-check app and tooling configs                                  |
| `npm run lint`         | ESLint                                                              |

## Deploying

Hosting is intentionally left to you. The included `firebase.json` already points Firebase Hosting at
Vite's `dist/` output (the old project pointed at CRA's `build/`). Set your project id in `.firebaserc`,
then:

```sh
npm run build
npx firebase deploy --only hosting
```

## Architecture

```
data/source/      Read-only copies of the upstream word lists, with provenance in SOURCES.md
tools/            Build-time data pipeline (pinyin + simplified/traditional conversion)
public/data/      Generated per-list JSON, fetched lazily at runtime
src/domain/       Pure logic: types, scheduler, distractors, session reducer, pinyin rendering
src/content/      Manifest + list loading + word indexing
src/storage/      IndexedDB repositories and versioned settings
src/ui/           Design tokens, primitives and hooks
src/features/     Screens: home, session, summary, review, progress, settings
```

Design notes:

- **No pinyin or conversion library ships to the client.** `pinyin-pro` and `opencc-js` are
  dev dependencies used only by `tools/build-data.ts`.
- **Per-syllable pinyin is stored as data** (`{ base, marked, tone }`), so tone-marked diacritics,
  tone numbers and superscript styles are all derivable at runtime with no conversion cost.
- **Word lists are lazy-loaded** so the device only downloads the list being played.
- **Nothing is sized with `vh`.** The shell uses `dvh` with a `svh` fallback plus safe-area insets.

## Attribution and licensing

See `data/source/SOURCES.md` and the in-app attribution screen. The English glosses are derived from
upstream word lists; verify their licence terms before redistributing this app publicly.
