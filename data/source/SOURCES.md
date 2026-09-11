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

Two licences apply, and they are not the same one.

**The code is MIT** — see `LICENSE`.

**These lists, and everything generated from them (`public/data/lists/*.json`), are CC BY-SA 4.0.**

The English glosses are CC-CEDICT-derived. That is a match rather than a resemblance: CC-CEDICT gives
哪 (něi) as "which? (interrogative, followed by classifier or numeral-classifier)", which is verbatim
the gloss in `hsk1.ts`, and 爱 as "to love / affection / to be fond of / to like". CC-CEDICT is licensed
CC BY-SA 4.0, so these files inherit attribution and share-alike terms and **cannot be relicensed as
MIT**.

The upstream lists this repo copies (`hsk.academy`, Jun Da) do not appear to carry CC-CEDICT attribution
themselves, so credit the real source:

> Definitions from CC-CEDICT, licensed CC BY-SA 4.0.

Obligations, which apply to every redistributed copy of the generated JSON as well as to this repo:

1. Credit CC-CEDICT and name the licence. The Settings screen does this — keep it in step.
2. License copies of the data under CC BY-SA 4.0. Do not relicense them as MIT.
3. State that the data has been changed. The build regenerates pinyin with `pinyin-pro`, converts
   traditional forms with `opencc-js`, de-duplicates entries, truncates glosses to the first sense for
   `glossShort`, normalises CC-CEDICT's internal markup out of the gloss text, drops senses that are
   usage notes rather than meanings, and applies the hand corrections listed in
   `tools/lib/glossOverrides.ts`. See `tools/lib/gloss.ts` for what the normalising does, and
   `tests/unit/dataQuality.test.ts` for the invariants it guarantees.

The `txt/` originals are kept for provenance only; the same terms apply to them.

Sources: <https://cc-cedict.org/> and <https://creativecommons.org/licenses/by-sa/4.0/>.
