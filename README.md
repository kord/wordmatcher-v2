# Word Matcher v2

Adaptive Mandarin and Taiwanese vocabulary drills, built as a portrait-first PWA for phones.

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
| `npm run deploy`       | Deploy to Firebase — see [Deploying](#deploying)                     |
| `npm run data:build`   | Regenerate `public/data/lists/*.json` from `data/source`            |
| `npm run icons`        | Regenerate the PWA icon set from `tools/build-icons.mjs`            |
| `npm run test`         | Unit tests (Vitest)                                                 |
| `npm run e2e`          | End-to-end tests (Playwright)                                       |
| `npm run typecheck`    | Type-check app and tooling configs                                  |
| `npm run lint`         | ESLint                                                              |

## Deploying

```sh
npm run deploy
```

Runs `firebase deploy` for the project in `.firebaserc`, publishing `dist/` to Hosting. A `predeploy`
hook builds first, so a failed type-check aborts the deploy instead of shipping the last build.

Because it is a bare `firebase deploy`, it also pushes the Firestore rules and auth config from
`firebase.json`. For the site alone, use `npx firebase deploy --only hosting`.

Players see rebuilt word lists one visit after a deploy: the service worker serves the cached copy
first, then refreshes it in the background.

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

- **No romanisation or conversion library ships to the client.** `pinyin-pro` and `opencc-js` are
  dev dependencies used only by `tools/build-data.ts`.
- **Per-syllable readings are stored as data** (`{ base, marked, tone }`), so tone-marked diacritics,
  tone numbers and superscript styles are all derivable at runtime with no conversion cost. One shape
  covers pinyin and Tâi-lô alike, and hyphen and space placement is recovered from the marked text
  rather than stored beside it, so the two cannot drift apart.
- **Each language is a separate lesson.** Progress, session history, settings and word lists are all
  scoped to one variety, and drilling one never moves the other's numbers.
- **Word lists are lazy-loaded** so the device only downloads the list being played.
- **Nothing is sized with `vh`.** The shell uses `dvh` with a `svh` fallback plus safe-area insets.

## Licensing

**The code is MIT** — see `LICENSE`. Use it, fork it, ship it, sell it; just keep the copyright notice.

**The word-list data is not covered by that.** The English glosses in `data/source/` and the generated
`public/data/lists/*.json` are CC-CEDICT-derived, and CC-CEDICT is licensed
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) — attribution plus share-alike. The
Taiwanese readings come from the 臺華雙語辭典 via
[ChhoeTaigi](https://github.com/ChhoeTaigi/ChhoeTaigiDatabase), under the same licence. Those files are
therefore distributed under CC BY-SA 4.0, not MIT, and copies of them (including the JSON the app
downloads) have to carry the same licence.

A permissive licence on the code alongside a share-alike licence on the data is a normal arrangement,
but it does mean the project is not MIT end to end. Making it so would mean replacing the glosses with
original or CC0 text. See `data/source/SOURCES.md` for the details and the outstanding obligations.
