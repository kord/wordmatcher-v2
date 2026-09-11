import type { CharacterSet, FaceKind, Objective, QuestionFace, WordEntry } from './types'

/**
 * Which surface is shown as the prompt and which as the answers, per objective.
 * Adding an objective means adding two entries here plus a scheduler weight.
 */
const PROMPT_KIND: Record<Objective, FaceKind> = {
  'zh-en': 'han',
  'en-zh': 'gloss',
  'zh-pinyin': 'han',
  'pinyin-zh': 'pinyin',
}

const ANSWER_KIND: Record<Objective, FaceKind> = {
  'zh-en': 'gloss',
  'en-zh': 'han',
  'zh-pinyin': 'pinyin',
  'pinyin-zh': 'han',
}

const OBJECTIVE_LABELS: Record<Objective, string> = {
  'zh-en': 'Chinese → English',
  'en-zh': 'English → Chinese',
  'zh-pinyin': 'Chinese → pinyin',
  'pinyin-zh': 'Pinyin → Chinese',
}

/**
 * Instruction shown above the prompt. This must follow the objective, not the
 * prompt's surface: a Chinese → pinyin question shows characters but asks for
 * the reading, so keying off the prompt would tell the player to pick a meaning.
 */
const TASK_HINTS: Record<Objective, string> = {
  'zh-en': 'Choose the meaning',
  'en-zh': 'Choose the word',
  'zh-pinyin': 'Choose the pinyin',
  'pinyin-zh': 'Choose the word',
}

export function promptKindFor(objective: Objective): FaceKind {
  return PROMPT_KIND[objective]
}

export function answerKindFor(objective: Objective): FaceKind {
  return ANSWER_KIND[objective]
}

export function objectiveLabel(objective: Objective): string {
  return OBJECTIVE_LABELS[objective]
}

export function taskHintFor(objective: Objective): string {
  return TASK_HINTS[objective]
}

export function faceFor(entry: WordEntry, kind: FaceKind, charset: CharacterSet): QuestionFace {
  switch (kind) {
    case 'han':
      return { kind, text: charset === 'trad' ? entry.trad : entry.simp }
    case 'gloss':
      return { kind, text: entry.glossShort }
    case 'pinyin':
      return { kind, text: entry.pinyin.marked, pinyin: entry.pinyin }
  }
}

/** Identity of a face for de-duplication: two options must never read the same. */
export function faceKey(face: QuestionFace): string {
  return `${face.kind}:${face.text}`
}
