/**
 * One hand-authored Taiwanese form.
 *
 * `[simplified, Taiwanese characters, Tâi-lô, POJ, note?]`
 *
 * A tuple rather than an object because the value of these lists is that a person can read them
 * straight down the page and see the pattern: the Mandarin word, the word that is actually said,
 * and how it is written. One line per word is the most reviewable shape available.
 *
 * An empty character field means the word has no settled character and the app falls back to the
 * romanisation, which is how the particles are written anyway.
 *
 * Conventions, all matching how the source and the Ministry of Education write Tâi-lô:
 *   - `-` separates syllables inside a word, `--` marks a neutral-tone syllable.
 *   - POJ writes `ch`/`chh` for Tâi-lô `ts`/`tsh`, `o͘` for `oo`, `eng` for `ing`, `ek` for `ik`,
 *     `oe` for `ue` and `oa` for `ua`.
 *   - A nasalised vowel is `nn` in Tâi-lô and `ⁿ` in POJ. An onset `nn` is the same in both.
 *   - For the `ui` diphthong the tone mark moves in POJ: `tuì` is `tùi`.
 */
export type HandRow = readonly [string, string, string, string, string?]
