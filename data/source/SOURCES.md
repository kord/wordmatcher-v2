# Data sources

These files are read-only copies of the word lists used by the original `wordmatcher` project. They are
inputs to `tools/build-data.ts`; do not edit them by hand.

## HSK vocabulary (`hsk1.ts` … `hsk6.ts`)

- Source: <https://hsk.academy/en/hsk-6-vocabulary-list>
- Shape: `[simplified characters, English gloss][]`
- Counts: 150 / 150 / 300 / 600 / 1300 / 2500

## Jun Da character frequency (`junDa.ts`)

- Source: Jun Da's Modern Chinese Character Frequency List —
  <https://docs.google.com/spreadsheets/d/1b4V0k0h5n_ey7IHogO8741lM6dxnpri3z3KIxs6sqGA>
  (web version: <http://hanzidb.org/character-list/by-frequency>)
- Shape: `[simplified character, English gloss][]`, in descending frequency order.
- 79 of the top 5,000 characters are commented out upstream and therefore absent from the generated
  list. `rank` in the generated JSON is the position within this file, not the upstream rank.

## Simplified/traditional character list (`simplifiedTraditionalDictionary.ts`)

- Source: <https://www.tutormandarin.net/en/list-of-different-simplified-and-traditional-characters/>
- Used for reference only. Traditional forms in the generated JSON come from OpenCC, and the pair list
  itself is not surfaced as a game mode in v2 yet.

## Unused originals (`txt/`)

`hsk*.txt`, `simptrad.txt` and `taipei metro.txt` are the pre-TypeScript originals. They are kept for
provenance and are **not** read by the build. Note that the pinyin in `hsk*.txt` predates the move to
`pinyin-pro` and contains known errors (for example `频率  pín lv4`); the build derives pinyin from the
characters instead.

## Libraries used at build time

- [pinyin-pro](https://github.com/zh-lx/pinyin-pro) — tone-marked and numbered pinyin.
- [opencc-js](https://github.com/nk2028/opencc-js) — simplified to Taiwanese traditional conversion.

Both are dev dependencies and ship no code to the client.

## Licensing

No licence file accompanied the original repository, and the gloss text resembles CC-CEDICT-derived
content. **Verify the licence terms of each upstream list before distributing this app publicly**, and
keep the in-app attribution screen up to date.
