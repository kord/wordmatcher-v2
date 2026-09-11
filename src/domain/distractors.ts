import type { CharacterSet, Objective, Question, QuestionOption, WordEntry } from './types'
import { answerKindFor, faceFor, faceKey, promptKindFor } from './faces'
import type { Rng } from './rng'
import { pickWeighted, shuffle } from './rng'

export interface BuildQuestionInput {
  entry: WordEntry
  objective: Objective
  pool: readonly WordEntry[]
  optionCount: number
  charset: CharacterSet
  rng: Rng
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

export function buildQuestion(input: BuildQuestionInput): Question {
  const { entry, objective, pool, charset, rng } = input
  const answerKind = answerKindFor(objective)
  const prompt = faceFor(entry, promptKindFor(objective), charset)
  const answerFace = faceFor(entry, answerKind, charset)

  // Candidates must be distinct words that do not *read* the same as anything
  // already chosen. The original app deduped on the raw word string, which let
  // two options with an identical gloss appear side by side.
  const usedFaces = new Set<string>([faceKey(answerFace)])
  const candidates: WordEntry[] = []

  for (const candidate of pool) {
    if (candidate.id === entry.id) continue
    const key = faceKey(faceFor(candidate, answerKind, charset))
    if (usedFaces.has(key)) continue
    usedFaces.add(key)
    candidates.push(candidate)
  }

  const chosen: WordEntry[] = [entry]
  const remaining = [...candidates]
  // Never loop forever: if the pool is small, present fewer options instead.
  const target = Math.max(2, Math.min(input.optionCount, remaining.length + 1))

  while (chosen.length < target && remaining.length > 0) {
    const picked = pickWeighted(remaining, (candidate) => 1 + similarity(entry, candidate), rng)
    if (!picked) break
    chosen.push(picked)
    remaining.splice(remaining.indexOf(picked), 1)
  }

  const options: QuestionOption[] = shuffle(chosen, rng).map((optionEntry) => ({
    entry: optionEntry,
    face: faceFor(optionEntry, answerKind, charset),
    isAnswer: optionEntry.id === entry.id,
  }))

  return {
    id: `${entry.id}:${objective}`,
    objective,
    entry,
    prompt,
    options,
  }
}
