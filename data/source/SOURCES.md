# Data sources

These files are inputs to `tools/build-data.ts`; do not edit them by hand.

Most are read-only copies of the word lists used by the original `wordmatcher` project. `taiwanese.json`
is different: it is a filtered extract of an upstream dictionary, described below.

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

## Taiwanese readings (`taiwanese.json`)

- Source: [ChhoeTaigi](https://github.com/ChhoeTaigi/ChhoeTaigiDatabase), dataset
  `ChhoeTaigi_TaihoaSoanntengTuichiautian.csv` — the 臺華雙語辭典.
- Licence: **CC BY-SA 4.0**, the same terms as the gloss data.
- Shape: `{ source, rows }`, where each row carries its Mandarin glosses, its Taiwanese written forms
  and its reading in both romanisations.

The upstream file is 9.8 MB and describes the whole language, so it is not vendored. Instead
`tools/extract-taigi.ts` keeps a row when **either** its Mandarin gloss or its Taiwanese characters
match a word already in our HSK lists, and writes the 848 KB result here. That extract is itself a
derivative and carries the source's share-alike terms.

Regenerate it with `npx tsx tools/extract-taigi.ts <path-to-csv>`. It defaults to `%TEMP%\taigi\`, and
the download URL is recorded as `SOURCE_URL` in that script.

Both romanisations come from the source's own parallel columns — `KipUnicode` is Tâi-lô, the scheme
Taiwan's Ministry of Education uses, and `PojUnicode` is POJ. Neither is derived from the other, and
neither is derived by us.

### Datasets in the same collection that are *not* used

- 教育部臺灣閩南語常用詞辭典 — CC BY-ND 3.0 TW. NoDerivatives, so it cannot be redistributed in a
  modified form, which is what embedding it in our JSON would be.
- iTaigi — CC0, so usable, but its rows are whole sentences rather than headwords, so a word-keyed
  join matches almost nothing. It was used only as a cross-check while choosing the source.
- 台日大辭典, Maryknoll, Embree, 甘字典 — CC BY-NC-SA. Non-commercial, so out of scope.

### Changes made to the Taiwanese data

The list is built two different ways depending on the level, and the difference is a declared
modification either way.

**HSK 1** was derived from the source: a form was picked mechanically and then corrected.

1. Filtered to the rows that can describe one of our HSK words.
2. One Taiwanese form chosen per word by `tools/lib/taiwanese.ts`: a row whose characters match ours (a
   reading of the same word) beats a row that merely shares a Mandarin gloss, then the shorter headword
   wins, because the source is sorted alphabetically by romanisation and carries no frequency signal.
3. Hand corrections, listed in `tools/lib/taiwaneseOverrides.ts`.
4. Readings parsed from the source's spelling into per-syllable form by `tools/lib/taigiReading.ts`, so
   the app can render them in either orthography or as tone numbers.
5. Re-encoded and re-ordered; the romanisations and headwords themselves are unaltered except where
   step 3 says otherwise.

**HSK 2 and later** invert that: the Taiwanese form for every word was written by hand first, from
knowledge of the language, and only then checked against the source. The reason is that by this level
the everyday Taiwanese word is frequently not the character in front of you at all — 跑步 is 走 but 走
is 行, 黑 is 烏, 玩 is 耍, 找 is 揣, 眼睛 is 目睭, 忙 is 無閒 — and a ranking has no way to tell a
literary reading from the word people say.

1. Every form is authored in a table under `tools/lib/` — `taiwaneseHsk2.ts`, `taiwaneseHsk3.ts` and
   so on, sharing the row shape declared in `handAuthored.ts` — and marked `fromSource: false`, so a
   reviewer can tell these apart from the HSK 1 corrections that were merely pickings.
2. `tools/taigi-check.ts --level N` reports each one against the extract: whether the source knows the
   word, and separately whether it agrees on the spelling, the tones and the POJ. It also reports rows
   the Mandarin list needs and the table does not have, and rows no Mandarin word asks for, because
   both fail silently otherwise. The same report prints what the mechanical ranking would have chosen
   instead, per word.
3. Where the source carries the same word with a variant reading, the source's spelling is adopted, so
   one orthography runs across every level.
4. Each result is emitted as `hsk2-tw`, `hsk3-tw` and so on, alongside the Mandarin list it mirrors.

As shipped, the tables match a source reading exactly on 119 of 149 HSK 2 words, 218 of 298 HSK 3,
409 of 600 HSK 4 and 903 of 1,300 HSK 5. The remainder are words the extract lacks, words it carries
only in a literary reading, or a deliberate colloquial choice; they are listed per level in the check
report under `tmp/`. Where a tone still differs the hand-authored one is kept, because the source's
own column disagrees with itself often enough that a difference is not evidence of an error on its
own — HSK 5 keeps 22 such tones.

**How much the mechanical ranking would have got wrong.** Because the tables are authored
independently of the source's ranking, the two can be compared, and `taigi-check` does: for each word
it re-runs the ranking with no override in place and says whether it would have landed on the same
form, the same word with a different reading, a different word, or nothing at all.

| Level | same | different reading | different word | nothing | would differ |
| ----- | ---- | ----------------- | -------------- | ------- | ------------ |
| HSK 4 | 380 (63%) | 96 (16%) | 84 (14%) | 40 (7%) | 37% |
| HSK 5 | 864 (66%) | 192 (15%) | 172 (13%) | 72 (6%) | 34% |

Roughly a third of the corpus, then. The "different reading" column is the quiet one: those rows
would have shown the right word with the wrong pronunciation, which reads as correct to anyone who
does not already know the word. HSK 5 examples include 包子 as 鋼包 `kǹg-pau`, 打招呼 as 叫金鼓 and
厕所 as 廁所 `tshik-sóo`; the ranking was better than the table on a handful, such as 當 "to be" as
`tang` and 吃驚 as 生驚 `tshenn-kiann`.

**Romanisation.** Both schemes are hand-written for every row, so each one is a chance to copy the
column next to it. `tests/unit/taigiDataQuality.test.ts` catches a POJ column that is byte-identical
to the Tâi-lô one, but that misses a half-finished conversion — `tsng-sek` differs from `tsng-sik`, so
it passes, and still says `tsng` where POJ says `chng`. `tools/poj-check.ts` closes that gap by
reducing each column to the spelling the other scheme would require and comparing; it prints the
conversion it uses, and `tools/scheme-pairs.ts` derives that conversion from the extract rather than
from documentation, by aligning every source row that carries both romanisations.

`tests/unit/taigiDataQuality.test.ts` checks every built Taiwanese list against the same invariants,
so a new level cannot ship without meeting them.

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
>
> Taiwanese readings from the 臺華雙語辭典, via ChhoeTaigi, licensed CC BY-SA 4.0.

Obligations, which apply to every redistributed copy of the generated JSON as well as to this repo:

1. Credit CC-CEDICT and ChhoeTaigi, naming the licence for each. The Settings screen does this — keep
   it in step.
2. License copies of the data under CC BY-SA 4.0. Do not relicense them as MIT.
3. State that the data has been changed. The build regenerates pinyin with `pinyin-pro`, converts
   traditional forms with `opencc-js`, de-duplicates entries, truncates glosses to the first sense for
   `glossShort`, normalises CC-CEDICT's internal markup out of the gloss text, drops senses that are
   usage notes rather than meanings, and applies the hand corrections listed in
   `tools/lib/glossOverrides.ts`. See `tools/lib/gloss.ts` for what the normalising does, and
   `tests/unit/dataQuality.test.ts` for the invariants it guarantees.

The `txt/` originals are kept for provenance only; the same terms apply to them.

Sources: <https://cc-cedict.org/> and <https://creativecommons.org/licenses/by-sa/4.0/>.
