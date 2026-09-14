import { romanizationFor } from './romanization'
import type {
    CharacterSet,
    FaceKind,
    Objective,
    QuestionFace,
    RomanizationScheme,
    WordEntry,
} from './types'

/**
 * Which surface is shown as the prompt and which as the answers, per objective.
 * Adding an objective means adding two entries here plus a weight in `objectives.ts`.
 *
 * These are expressed in terms of surfaces rather than in terms of Mandarin, so the four
 * original objectives carry over to Taiwanese unchanged: 'han' is whatever characters the entry
 * is written in, and 'romanization' is pinyin or Tai-lo as that entry requires. The objective ids
 * keep their historical spelling because they are persisted on stored sessions and renaming them
 * would orphan existing history.
 */
const PROMPT_KIND: Record<Objective, FaceKind> = {
    'zh-en': 'han',
    'en-zh': 'gloss',
    'zh-pinyin': 'han',
    'pinyin-zh': 'romanization',
    'zh-tw': 'mandarin',
}

const ANSWER_KIND: Record<Objective, FaceKind> = {
    'zh-en': 'gloss',
    'en-zh': 'han',
    'zh-pinyin': 'romanization',
    'pinyin-zh': 'han',
    'zh-tw': 'han',
}

const OBJECTIVE_LABELS: Record<Objective, string> = {
    'zh-en': 'Characters → English',
    'en-zh': 'English → characters',
    'zh-pinyin': 'Characters → reading',
    'pinyin-zh': 'Reading → characters',
    'zh-tw': 'Mandarin → Taiwanese',
}

/**
 * Instruction shown above the prompt. This must follow the objective, not the
 * prompt's surface: a characters → reading question shows characters but asks for
 * the reading, so keying off the prompt would tell the player to pick a meaning.
 */
const TASK_HINTS: Record<Objective, string> = {
    'zh-en': 'Choose the meaning',
    'en-zh': 'Choose the word',
    'zh-pinyin': 'Choose the reading',
    'pinyin-zh': 'Choose the word',
    'zh-tw': 'Choose the Taiwanese word',
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

export function faceFor(
    entry: WordEntry,
    kind: FaceKind,
    charset: CharacterSet,
    scheme: RomanizationScheme,
): QuestionFace {
    switch (kind) {
        case 'han': {
            const han = charset === 'trad' ? entry.trad : entry.simp
            // Not every Taiwanese word has a settled character: the negator is written `m̄`
            // and 的 is written `ê`, with the romanisation doing the work a character would
            // otherwise do. An empty prompt would be worse than showing how it is written.
            if (han.length > 0) return { kind, text: han }
            return { kind, text: romanizationFor(entry, scheme)?.marked ?? entry.simp }
        }
        case 'mandarin': {
            const counterpart = entry.mandarin
            // Unreachable in play: the contrast objective is only offered when the counterpart
            // exists and is written differently. The fallback just keeps this a total function.
            if (!counterpart) return faceFor(entry, 'han', charset, scheme)
            return { kind, text: charset === 'trad' ? counterpart.trad : counterpart.simp }
        }
        case 'gloss':
            return { kind, text: entry.glossShort }
        case 'romanization': {
            const romanization = romanizationFor(entry, scheme)
            return { kind, text: romanization?.marked ?? '', romanization }
        }
    }
}

/** Identity of a face for de-duplication: two options must never read the same. */
export function faceKey(face: QuestionFace): string {
    return `${face.kind}:${face.text}`
}
