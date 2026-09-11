import { answerKindFor, faceFor, faceKey, promptKindFor } from './faces'
import { syntheticPinyinOptions } from './fakePinyin'
import type { Rng } from './rng'
import { pickWeighted, shuffle } from './rng'
import type {
  CharacterSet,
  Objective,
  Question,
  QuestionFace,
  QuestionOption,
  WordEntry,
} from './types'

export interface BuildQuestionInput {
  entry: WordEntry
  objective: Objective
  pool: readonly WordEntry[]
  optionCount: number
  charset: CharacterSet
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
  if (candidate.pinyin.syllables.length === answer.pinyin.syllables.length) score += 1.5
  if (Math.abs(candidate.simp.length - answer.simp.length) <= 1) score += 1
  return score
}

/**
 * Countable units on a face: syllables for pinyin, characters for han. For
 * `不但…而且…` both come to six, so the two directions stay consistent.
 */
function visibleLength(face: QuestionFace): number {
  if (face.kind === 'pinyin' && face.pinyin) return face.pinyin.syllables.length
  return Array.from(face.text).length
}

export function buildQuestion(input: BuildQuestionInput): Question {
  const { entry, objective, pool, charset, rng } = input
  const answerKind = answerKindFor(objective)
  const prompt = faceFor(entry, promptKindFor(objective), charset)
  const answerFace = faceFor(entry, answerKind, charset)

  // Length must never give the answer away. Every option shows the same number
  // of syllables (pinyin answers) or characters (character answers); a three
  // syllable reading sitting among one syllable readings is guessable without
  // knowing any Chinese. Glosses are exempt: their length carries no signal and
  // varies legitimately.
  const constrainLength = answerKind !== 'gloss'
  const requiredLength = visibleLength(answerFace)

  const seenFaces = new Set<string>([faceKey(answerFace)])
  const sameLength: WordEntry[] = []
  const differentLength: WordEntry[] = []

  for (const candidate of pool) {
    if (candidate.id === entry.id) continue

    const face = faceFor(candidate, answerKind, charset)
    const key = faceKey(face)
    // Options must also not *read* the same, whatever their length.
    if (seenFaces.has(key)) continue
    seenFaces.add(key)

    if (!constrainLength || visibleLength(face) === requiredLength) {
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
      drafts.push({ face: faceFor(picked, answerKind, charset), entry: picked, isAnswer: false })
      remaining.splice(remaining.indexOf(picked), 1)
    }
  }

  // Tier 1: real words of the same visible length. For HSK this is often only a
  // handful of words (HSK 1 holds seven three-character words, HSK 3 holds a
  // single four-character one), so the next tier matters.
  takeDistractors(sameLength)

  // Tier 2: pinyin readings can be invented at the right syllable count, so a
  // pinyin question always gets a full set of options.
  if (drafts.length < target && answerKind === 'pinyin' && answerFace.pinyin) {
    const synthetic = syntheticPinyinOptions({
      answer: answerFace.pinyin,
      count: target - drafts.length,
      taken: new Set(drafts.map((draft) => faceKey(draft.face))),
      rng,
    })

    for (const reading of synthetic) {
      drafts.push({
        face: { kind: 'pinyin', text: reading.marked, pinyin: reading },
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
