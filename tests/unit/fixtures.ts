import type { Pinyin, PinyinSyllable, ProgressRecord, Tone, WordEntry } from '../../src/domain/types'

let autoId = 0

/** Build pinyin from numbered syllables, e.g. `makePinyin('ni3', 'hao3')`. */
export function makePinyin(...numbered: string[]): Pinyin {
    const syllables: PinyinSyllable[] = numbered.map((input) => {
        const match = /(\d)$/.exec(input)
        const digit = match ? Number(match[1]) : 0
        const tone: Tone = digit >= 1 && digit <= 4 ? (digit as Tone) : 0
        const base = input.replace(/\d$/, '')
        return { base, marked: input, tone, han: /^[a-zA-ZüÜ]+$/.test(base) }
    })

    return {
        marked: syllables.map((syllable) => syllable.marked).join(' '),
        numbered: numbered.join(' '),
        syllables,
    }
}

export function makeEntry(partial: Partial<WordEntry> & { simp: string }): WordEntry {
    const glosses = partial.glosses ?? ['a gloss']
    const entry: WordEntry = {
        id: partial.id ?? `auto-${autoId++}`,
        simp: partial.simp,
        trad: partial.trad ?? partial.simp,
        pinyin: partial.pinyin ?? makePinyin('ma1'),
        glosses,
        glossShort: partial.glossShort ?? glosses[0],
        classifiers: partial.classifiers ?? [],
        listId: partial.listId ?? 'test',
    }

    if (partial.hsk !== undefined) entry.hsk = partial.hsk
    if (partial.rank !== undefined) entry.rank = partial.rank
    return entry
}

export function makeProgress(
    partial: Partial<ProgressRecord> & { wordId: string },
): ProgressRecord {
    return {
        wordId: partial.wordId,
        box: partial.box ?? 0,
        correctStreak: partial.correctStreak ?? 0,
        lapses: partial.lapses ?? 0,
        seen: partial.seen ?? 0,
        correct: partial.correct ?? 0,
        dueAt: partial.dueAt ?? 0,
        lastSeenAt: partial.lastSeenAt ?? 0,
        totalMs: partial.totalMs ?? 0,
    }
}
