import {
    BOX_WEIGHTS,
    INTERVALS_MS,
    MAX_BOX,
    NOVELTY_WEIGHT,
    OVERDUE_CAP_DAYS,
    PROMOTE_STREAK,
    UNDUE_FLOOR,
    WRONG_AGAIN_MS,
} from './constants'
import type { Rng } from './rng'
import { pickWeighted } from './rng'
import type { Language, Outcome, ProgressRecord, WordEntry } from './types'

const DAY_MS = 24 * 60 * 60 * 1000

export function clampBox(box: number): number {
    return Math.max(0, Math.min(MAX_BOX, Math.round(box)))
}

export function createProgress(wordId: string, language: Language, now: number): ProgressRecord {
    return {
        wordId,
        // Progress is siloed per variety, so a record has to say which one it belongs to.
        language,
        box: 0,
        correctStreak: 0,
        lapses: 0,
        seen: 0,
        correct: 0,
        dueAt: now,
        lastSeenAt: 0,
        totalMs: 0,
    }
}

export function intervalFor(box: number): number {
    return INTERVALS_MS[clampBox(box)]
}

export function isMastered(record: ProgressRecord): boolean {
    return record.box >= MAX_BOX
}

export function accuracy(record: ProgressRecord): number {
    return record.seen === 0 ? 0 : record.correct / record.seen
}

/**
 * Selection priority. Higher means more likely to be asked next.
 *
 * Weak words (low box) dominate; overdue words get a boost that saturates after
 * a few days; unseen words get a novelty boost so new material keeps arriving.
 */
export function scoreCandidate(record: ProgressRecord | undefined, now: number): number {
    if (!record || record.seen === 0) {
        return BOX_WEIGHTS[0] * NOVELTY_WEIGHT
    }

    const base = BOX_WEIGHTS[clampBox(record.box)]

    const overdueDays = (now - record.dueAt) / DAY_MS
    const overdueFactor =
        overdueDays < 0 ? UNDUE_FLOOR : Math.min(1 + overdueDays, 1 + OVERDUE_CAP_DAYS)

    return base * overdueFactor
}

/**
 * Choose the next word. Recently shown words are excluded so nothing repeats
 * back-to-back; if that empties the pool we fall back to the full pool rather
 * than failing.
 */
export function pickNextWord(
    pool: readonly WordEntry[],
    progress: ReadonlyMap<string, ProgressRecord>,
    recentIds: readonly string[],
    rng: Rng,
    now: number,
): WordEntry | undefined {
    const excluded = new Set(recentIds)
    const eligible = pool.filter((entry) => !excluded.has(entry.id))
    const candidates = eligible.length > 0 ? eligible : pool

    return pickWeighted(candidates, (entry) => scoreCandidate(progress.get(entry.id), now), rng)
}

/**
 * Fold one answer into a word's progress.
 *
 * Correct answers build a streak and promote the word after `PROMOTE_STREAK`
 * in a row; a miss demotes it and makes it due again almost immediately.
 */
export function applyOutcome(
    record: ProgressRecord,
    outcome: Outcome,
    now: number,
    msToAnswer: number,
): ProgressRecord {
    const next: ProgressRecord = {
        ...record,
        seen: record.seen + 1,
        lastSeenAt: now,
        totalMs: record.totalMs + Math.max(0, msToAnswer),
    }

    if (outcome === 'correct') {
        next.correct = record.correct + 1
        next.correctStreak = record.correctStreak + 1

        if (next.correctStreak >= PROMOTE_STREAK) {
            next.box = clampBox(record.box + 1)
            next.correctStreak = 0
        }

        next.dueAt = now + intervalFor(next.box)
    } else {
        next.lapses = record.lapses + 1
        next.correctStreak = 0
        next.box = clampBox(record.box - 1)
        next.dueAt = now + WRONG_AGAIN_MS
    }

    return next
}
