# Data sources

These files are inputs to `tools/build-data.ts`; do not edit them by hand.

Most are read-only copies of the word lists used by the original `wordmatcher` project. `taiwanese.json`
is different: it is a filtered extract of an upstream dictionary, described below.

## Reading a source versus shipping it

"We used a dictionary" covers two activities, and only one of them is governed by the source's licence.

**Reading a source** — looking up what a word is called, then writing our own row — uses the facts the
dictionary records. A word's form, its reading and its sense are facts; copyright protects the
expression of them, not the facts themselves. This needs no permission from anyone, whatever the
licence says. It is also already how the hand-authored tables work (`tools/lib/taiwaneseHsk2.ts` and
up): the Taiwanese form for every word is written first, from knowledge of the language, and the source
is then consulted to check it.

**Shipping a source** — copying rows into `data/source/` or into the generated JSON — is reproduction,
and there the licence is the constraint, because we are distributing copies rather than using what they
say. Two sources are shipped today, CC-CEDICT for the glosses and ChhoeTaigi for the Taiwanese
readings, both CC BY-SA 4.0, and both are compliant.

The line this draws, for any source we look at:

- Reading it, and recording a form, a reading or a sense: always fine.
- Taking one of its rows instead of writing our own: fine only under the source's licence, and only
  because we can attribute it. HSK 1's `fromSource: true` corrections are this case.
- Reproducing a definition's wording, an example sentence, or a headword list wholesale: never. That is
  the dictionary's expression and its selection, both of which are protected.
- Mirroring a large share of a source's headwords into ours: the same thing at scale. A NoDerivatives or
  NonCommercial licence bites here even though it cannot touch consultation.

So the licence column below reads as "may we ship this", not "may we look at this".

Exposure scales with volume and with how far one source carries us. A few dozen words checked against a
dictionary is consultation; a level whose every answer could only have come from a single dictionary is
closer to copying its selection. That is worth avoiding on its own terms, not only licensing ones — a
second opinion is what catches the mistakes one source would have propagated.

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

### Datasets in the same collection that are *not* shipped

Excluded from `taiwanese.json`, which is a different thing from being unusable as a reference — see
"Reading a source versus shipping it" above.

- 教育部臺灣閩南語常用詞辭典 — CC BY-ND 3.0 TW. NoDerivatives, so a copy cannot be redistributed in a
  modified form, which is what embedding its rows in our JSON would be. Re-checked against the fork that
  carries it, which states the same terms — see "Other Taiwanese corpora surveyed" below. Reading it to
  check a hand-authored row is unaffected, and is worth doing.
- iTaigi — CC0, so shippable, but its rows are whole sentences rather than headwords, so a word-keyed
  join matches almost nothing. It was used only as a cross-check while choosing the source.
- 台日大辭典, Maryknoll, Embree, 甘字典 — CC BY-NC-SA. Non-commercial, and the share-alike term would
  conflict with the CC BY-SA 4.0 we ship under, so they are out of scope for copying. Fine to read.

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

## Other Taiwanese corpora surveyed

The [Taiwanese-Corpus](https://github.com/Taiwanese-Corpus) organisation was surveyed as a possible
second Taiwanese source. **Nothing from it is vendored**, so it adds no licensing obligation; this
section records what was looked at and why it was not taken, so the same ground is not covered twice.

The organisation is 47 repositories, almost all mirrors or transcriptions of third-party works
maintained by one person, and most declare no licence at all. Its own index is
[hue7jip8](https://github.com/Taiwanese-Corpus/hue7jip8) (MIT) — "Huē-ji̍p", the importer that feeds
corpora into the 臺灣言語資料庫 format — and that README is the most useful thing in the collection,
because it catalogues every Taiwanese corpus the author knows of with its form and size.

| corpus | form | size | may we ship it |
| ------ | ---- | ---- | -------------- |
| 臺灣閩南語常用詞辭典 (詞條 / 例句) | 全漢、全羅 | 28,830 / 13,835 | no — CC BY-ND 3.0 TW |
| 台語文語料庫蒐集及語料庫為本字詞頻統計 (guliau-supin) | 漢羅、全羅 | 193,071 段 | no — undeclared, MOE-derived |
| iCorpus 臺華平行新聞語料庫 (漢字臺羅版) | 全羅、**華語平行** | 83,544 句 | **yes — CC BY 4.0** |
| 台語文數位典藏資料庫 (nmtl dadwt) | 漢羅、全羅 | 67,005 段 | no — undeclared |
| 教育部詞彙分級計劃 | 全漢、全羅 | 61,354 句 | unknown — MOE, API only |
| 教育部臺灣閩南語字詞頻調查工作 (KIPsupin) | 漢羅、全羅 | 59,300 段 | no — undeclared, MOE-derived |
| 白話字文獻館 (pojbh) | 漢羅、全羅 | 43,493 段 | no — undeclared |
| TGB通訊 | 漢羅、**華語平行** | 35,017 句 | no — undeclared |
| 台灣白話基礎語句 (1956) | 羅馬字、華語漢字 | 6,515 詞翻譯對照 | yes — public domain |
| 咱的字你敢捌－台語漢字 | 臺語→臺語 | 988 筆 | no — undeclared |
| 新北市900例句 | 全漢、全羅 | 150 句 + audio | yes — MIT |

Every one of them may be *read* regardless, which is the column that matters for hand-authoring.

Three conclusions:

1. **The best-known Taiwanese dictionary data is the one we already do not ship.** The fork carrying
   教育部臺灣閩南語常用詞辭典 is the most-forked item in the organisation, and its README states the
   NoDerivatives terms in the same words we do. It adds a detail worth knowing: the 華語對照表 — the
   Mandarin cross-reference table, i.e. exactly the shape our contrast drill needs — is *outside* the
   MOE licence, having been taken from the web edition under Copyright Act art. 50 for non-profit
   teaching. So it cannot be copied either, though it can be read like anything else.
2. **The one capability we lack is frequency, and no repository here supplies it for copying.** The
   ranking has no frequency signal (see "HSK 1" above), which is why 漂亮 picked 巧 `khiáu` over 媠
   `suí`. `Ungian_2009_KIPsupin` and `Ungian_2005_guliau-supin` are frequency work, but neither declares
   a licence, both derive from MOE-commissioned research, and the KIPsupin JSON is split by genre
   (`Sanbun`, `Siokgan`, `lunbun`, `pokoa`…), which reads as a segmented corpus rather than a word
   list. The most on-point resource in the field is 教育部詞彙分級計劃 — a graded vocabulary, 61,354
   sentences in both orthographies — but it is served from an MOE API rather than vendored, so shipping
   it is the ND problem again. All of them are worth reading to sanity-check a ranking.
3. **Mandarin↔Taiwanese parallel text exists with a permissive licence, and is parked.**
   [icorpus_ka1_han3-ji7](https://github.com/Taiwanese-Corpus/icorpus_ka1_han3-ji7) is 83,544
   Taiwanese–Mandarin sentence pairs (news, 2008–2014) with automatically tagged *and* human-corrected
   columns for both characters and Tâi-lô, released **CC BY 4.0** — attribution only, which is less
   restrictive than the CC BY-SA 4.0 we already carry. It speaks directly to the contrast drill, whose
   coverage falls to 9% at HSK 5 precisely because the Taiwanese word usually shares the Mandarin
   characters; a parallel corpus is how you see what the Taiwanese side actually says. It is not taken
   because it is sentence-aligned rather than word-aligned, the Taiwanese side is one translator's news
   register, and the yield against HSK vocabulary is unproven — a bounded experiment, not a
   commitment.

The 對照 dictionaries in the organisation are the right *genre* — Mandarin to Taiwanese word mappings,
which is the contrast drill's data — and under the rule above they are usable as **checking references**
for hand-authored rows even though nothing in them may be copied. Read them to confirm a form; do not
lift their rows or their definitions. That distinction is worth stating here rather than anywhere else,
because this is the genre covering our weakest area — contrast coverage falls to 9% by HSK 5 — so it is
also where the temptation to extract in bulk would be strongest.

Of the three, one turned out to be usable and is now in the pipeline:

- **`Loh8_2004_hanyu-document`** (駱嘉鵬) — the source of the second-opinion check below. Its
  `k_t_duiing.xls` is 12,965 rows of *character* readings keyed on the Mandarin reading, each flagged
  文 or 俗/白 where the literary and spoken readings of that character differ, and its `t_wenbai.xls`
  is 2,739 characters with the two readings side by side. Spelled in Tâi-lô with digit tones, which is
  what `Romanization.numbered` already produces, so the two compare syllable for syllable.
- **`koktai`** (吳守禮《國臺對照活用辭典》) — the most permissive of the three: Wikimedia Taiwan has a
  CC BY-SA grant from the estate, with the written agreement still in progress, and the reformatting is
  CC0. Not used yet because the text is Big5 with PE2 print control codes and needs a user-defined-glyph
  font to render at all, so reading it means working out a 造字 mapping first.
- **`Tai-Hua-Khah-Lan-Ku`** (黃元興 1992) — no data in the repository, only a README pointing at a blog.

### Second opinion on the readings (`tools/hantai-check.ts`)

Every row in the hand-authored tables was written for the word and then checked against the ChhoeTaigi
extract, which is word-keyed. That leaves one gap: a reading the extract does not know, or one both we
and it reached by the same character-match instinct, goes unchallenged. The reference above is
character-keyed and records *which* reading is the spoken one, so it asks two different questions — is
our reading attested for that character at all, and did we use the literary reading of a character whose
spoken reading is something else.

Because two dictionaries disagreeing only means one of them is wrong, every flagged syllable also gets
the extract's position on it, giving four verdicts: `theirs` (both sources against us), `ours` (the two
disagree and the extract backs us), `neither`, and `silent` (the extract has no reading for the
character). The reference is not vendored; `tools/xls-to-tsv.py` converts the two workbooks to a TSV
under `tmp/` after the download.

Across the four levels that were authored by hand it compares 4,313 syllables. The verdict `theirs` —
the tables and the extract both contradict us — came back 29 times: 0 in HSK 2, 3 in HSK 3, 8 in HSK 4
and 18 in HSK 5. **Sixteen were corrected**, and each was checked against the extract at *word* level
before being changed:

- **From** `tsông` **to** `tsiông` — 從此, 從而, 從前, 從事, 自從. 從前 the extract carries outright as
  `tsiông-tsiân`, so both syllables there were wrong.
- **From** `tsông-lâi` **to** `tsîng-lâi` — 從來. The 從 of 從來 is `tsîng`, and the 從 of 自從 is
  `tsiông`: the same character, two words, two readings, which is why each row was looked up separately.
- **From** `tshok` **to** `tshiok` — 促進, 促使.
- **From** `môo` **to** `bôo` — 模仿, 模糊, 模特.
- **From** `hou` **to** `hoo` — 招呼 in 拍招呼. The character tables gave 呼 as `khoo`, which would have
  been wrong; the extract's own 拍招呼 is `phah-tsio-hoo`.
- 熬夜 `gâu`→`gô`, 斜 `tshuâ`→`tshiâ`, 癢 `tsīnn`→`tsiunn`, 暈 `hîn`→`hūn`.

The extract then agrees *more* than before — over the two affected levels, 903→912 and 904→913 for HSK 5,
409→411 and 410→412 for HSK 4 — which is the real confirmation, because word-level evidence is stronger
than character-level evidence.

**Thirteen of the 29 are still standing, and not one of them is a wrong reading.** Seven rows across six
words were confirmed correct — in each, character evidence said we were wrong and the extract's own entry
for the word said we were right, which is the whole argument for demanding word evidence:

| word | character tables gave | the word is | cited by |
| ---- | --------------------- | ----------- | -------- |
| 香蕉 `king-tsio` | 香 as `hiang`/`hiunn` | `king-tsio` | the extract's own 香蕉 row |
| 馬虎 `má-hu` | 虎 as `hóo` | `má-hu` | the extract's own 馬虎 row |
| 普遍 `phóo-phiàn` | 遍 as `piàn` | `phóo-phiàn` | the extract's own 普遍 row |
| 管仔 `kóng-á` | 管 as `kńg` | `kóng-á` | the extract's own 管仔 row |
| 提 `the̍h` | 提 as `thê` | `the̍h` | 提 carries both; `thê` is the other sense |
| 雪文 `sap-bûn` | 雪 as `seh`/`suat` | `sap-bûn` | the only word where 雪 is `sap` |

The remaining six rows, across five words, are open for a different reason: the reading is right and the
*character* is borrowed from Mandarin, so no source attests it. 難 `oh` (the word is 惡 or 僫), 辣 `hiam`
and 辣椒 `hiam-tsio` (薟椒), 香 `phang` (芳), 找 `tshuē` (揣), and 毋過 `m̄-koh`, where nothing is wrong
but the MoE-recommended spelling is 毋閣. Changing the character changes what the learner reads and turns
the entry into a `differs: 'word'` contrast candidate, so these are a product decision rather than a
correction, and are left for the author.

The method has to be used with its limits in view. The reference has its own noise — it gives 肉 a
colloquial reading of `hik8`, which is not a thing — and a 文讀 is correct in plenty of formal compounds.
Two further traps cost real time and are worth naming:

- **Character evidence is not word evidence.** A compound can use a reading the character never has on
  its own, and character tables are built by reading characters.
- **Readings are compared without case.** Proper nouns are capitalised in our Tâi-lô (`Tn̂g-siânn` for the
  Great Wall), so a case-sensitive comparison reports every capitalised syllable as unattested — which
  is how 長城 and 長江 first appeared on the list.

`koktai` (吳守禮《國臺對照活用辭典》) is CC BY-SA via a grant from the estate arranged by Wikimedia Taiwan,
with the written agreement still in progress, and the reformatting is CC0 — so it is the most permissive
of the three. It is not used because the text is Big5 with PE2 print control codes and needs a
user-defined-glyph font to render at all.

`Tai-Hua-Khah-Lan-Ku` (黃元興 1992) holds no data in the repository, only a README pointing at a blog.

If a Hakka or Indigenous variety is ever wanted, the same organisation covers those with the same
integration pipeline (`moedict-data-hakka`, `hakka_elearning`, `klokah_data_extract`, `amis-data`),
and the licences are the same mixture of undeclared and ND.

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
