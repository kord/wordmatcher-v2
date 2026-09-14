import { answerKindFor, faceFor, faceKey, promptKindFor } from './faces'
import { syntheticPinyinOptions } from './fakePinyin'
import { DEFAULT_SCHEME, primaryRomanization } from './romanization'
import type { Rng } from './rng'
import { pickWeighted, shuffle } from './rng'
import type {
    CharacterSet,
    Objective,
    Question,
    QuestionFace,
    QuestionOption,
    RomanizationScheme,
    WordEntry,
} from './types'

export interface BuildQuestionInput {
    entry: WordEntry
    objective: Objective
    pool: readonly WordEntry[]
    optionCount: number
    charset: CharacterSet
    /**
     * Which romanisation to show.
     *
     * Optional because a caller without a learner preference - a test, or any future
     * non-interactive use - can take the entry's own default. The app always supplies the
     * player's choice, so this never decides anything in play.
     */
    scheme?: RomanizationScheme
    rng: Rng
}

interface DraftOption {
    face: QuestionFace
    entry?: WordEntry
    isAnswer: boolean
}

/**
 * How good a distractor a candidate makes. Preferring similar words keeps the
 * task honest: same level, same syllable count, similar length.
 */
function similarity(answer: WordEntry, candidate: WordEntry): number {
    let score = 0
    if (answer.hsk !== undefined && candidate.hsk === answer.hsk) score += 2

    const answerSyllables = primaryRomanization(answer)?.syllables.length ?? 0
    const candidateSyllables = primaryRomanization(candidate)?.syllables.length ?? 0
    if (candidateSyllables === answerSyllables) score += 1.5

    if (Math.abs(candidate.simp.length - answer.simp.length) <= 1) score += 1
    return score
}

const HAS_HAN = /\p{Script=Han}/u
const COMBINING_MARK = /\p{M}/gu

/**
 * Grouping key for "options of the same visible size".
 *
 * The size has to match so the player can never count their way to the answer. The modality has
 * to match as well, and that is the subtle half: a Taiwanese word with no settled character
 * falls back to its romanisation, and one romanisation standing among character options gives
 * itself away whichever end of the list it lands at - either obviously the answer, or obviously
 * not one. So a reading counts syllables (or letters, when the face carries no reading object)
 * and is never grouped with a word that counts characters.
 *
 * Glosses never reach here: `constrainLength` exempts them, because an English gloss's length
 * carries no signal and varies legitimately.
 */
function lengthKey(face: QuestionFace): string {
    if (face.kind === 'romanization' && face.romanization) {
        return `reading:${face.romanization.syllables.length}`
    }

    if (!HAS_HAN.test(face.text)) {
        // Counting letters rather than code points, so a combining tone mark does not make the
        // word look bigger than it is.
        const letters = face.text.normalize('NFD').replace(COMBINING_MARK, '')
        return `reading:${Array.from(letters).length}`
    }

    // Array.from, not .length: a character outside the basic plane is one visible character.
    return `word:${Array.from(face.text).length}`
}

export function buildQuestion(input: BuildQuestionInput): Question {
    const { entry, objective, pool, charset, rng } = input
    const scheme = input.scheme ?? DEFAULT_SCHEME[entry.language]
    const answerKind = answerKindFor(objective)
    const prompt = faceFor(entry, promptKindFor(objective), charset, scheme)
    const answerFace = faceFor(entry, answerKind, charset, scheme)

    // Length must never give the answer away. Every option shows the same number
    // of syllables (pinyin answers) or characters (character answers); a three
    // syllable reading sitting among one syllable readings is guessable without
    // knowing any Chinese. Glosses are exempt: their length carries no signal and
    // varies legitimately.
    const constrainLength = answerKind !== 'gloss'
    const requiredLength = lengthKey(answerFace)

    const seenFaces = new Set<string>([faceKey(answerFace)])
    const sameLength: WordEntry[] = []
    const differentLength: WordEntry[] = []

    for (const candidate of pool) {
        if (candidate.id === entry.id) continue

        const face = faceFor(candidate, answerKind, charset, scheme)
        const key = faceKey(face)
        // Options must also not *read* the same, whatever their length.
        if (seenFaces.has(key)) continue
        seenFaces.add(key)

        if (!constrainLength || lengthKey(face) === requiredLength) {
            sameLength.push(candidate)
        } else {
            differentLength.push(candidate)
        }
    }

    const target = Math.max(2, input.optionCount)
    const drafts: DraftOption[] = [{ face: answerFace, entry, isAnswer: true }]

    const takeDistractors = (candidates: readonly WordEntry[]) => {
        const remaining = [...candidates]
        while (drafts.length < target && remaining.length > 0) {
            const picked = pickWeighted(remaining, (candidate) => 1 + similarity(entry, candidate), rng)
            if (!picked) break
            drafts.push({
                face: faceFor(picked, answerKind, charset, scheme),
                entry: picked,
                isAnswer: false,
            })
            remaining.splice(remaining.indexOf(picked), 1)
        }
    }

    // Tier 1: real words of the same visible length. For HSK this is often only a
    // handful of words (HSK 1 holds seven three-character words, HSK 3 holds a
    // single four-character one), so the next tier matters.
    takeDistractors(sameLength)

    // Tier 2: pinyin readings can be invented at the right syllable count, so a
    // pinyin question always gets a full set of options.
    //
    // Pinyin only. The synthetic readings are built with pinyin's tone-mark placement,
    // which is not Tai-lo's, so a Tai-lo syllable put through it would come back
    // misspelled - and a misspelled wrong answer is worse than no wrong answer. Taiwanese
    // questions take every option from the pool instead, which the lists are large enough
    // to supply.
    if (
        drafts.length < target &&
        answerKind === 'romanization' &&
        answerFace.romanization?.scheme === 'pinyin'
    ) {
        const synthetic = syntheticPinyinOptions({
            answer: answerFace.romanization,
            count: target - drafts.length,
            taken: new Set(drafts.map((draft) => faceKey(draft.face))),
            rng,
        })

        for (const reading of synthetic) {
            drafts.push({
                face: { kind: 'romanization', text: reading.marked, romanization: reading },
                isAnswer: false,
            })
        }
    }

    // Tier 3: characters cannot be invented, so if the list has no same-length
    // peers we ask with two uniform options rather than four mixed ones that leak
    // the answer. Only if even that is impossible do we relax the length rule.
    if (drafts.length < 2) takeDistractors(differentLength)

    const options: QuestionOption[] = shuffle(drafts, rng).map((draft, index) => ({
        id: `${index}:${faceKey(draft.face)}`,
        ...(draft.entry ? { entry: draft.entry } : {}),
        face: draft.face,
        isAnswer: draft.isAnswer,
    }))

    return {
        id: `${entry.id}:${objective}`,
        objective,
        entry,
        prompt,
        options,
    }
}
