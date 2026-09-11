import type { Classifier } from '../../src/domain/types.ts'

/**
 * Upstream glosses are CC-CEDICT style, e.g.
 *   `to love; affection; CL:个[ge4] ,位[wei4]`
 * We keep every sense but lift the classifier annotations into structured data.
 *
 * The upstream text also carries CC-CEDICT's *internal* markup, and it was reaching
 * the screen verbatim: `字[pin1 yin1]` cross-references (`父亲` read "also pr. with
 * light tone [fu4 qin5]"), duplicated term prefixes (`甲` read "ten heavenly stems
 * 十天十天干"), mixed-width brackets (`清楚` read "（be) clear (about)") and a stray
 * unbalanced parenthesis (`您`). Everything below normalises that away at build time
 * so the corrections cannot drift back in.
 */
const CLASSIFIER_ANNOTATION = /CL:\s*[^;]*/gi
const CLASSIFIER_ITEM = /([^\s,[\]]+)\[([^\]]+)\]/g

/** `字[pin1 yin1]` - the bracket holds the reading of a referenced word. */
const PINYIN_NOTATION = /\s*\[[^[\]]*\d[^[\]]*\]/g

/**
 * A sense that is a note *about* the word rather than a meaning of it. These read
 * badly as definitions and worse as quiz prompts, so they are dropped.
 */
const NOTE_SENSE =
    /^(used in|variant of|old variant|see also|as opposed to|also written|(also|commonly|Taiwan) pr\.|pr\. )/i

export interface ParsedGloss {
    glosses: string[]
    glossShort: string
    classifiers: Classifier[]
}

/** Full-width punctuation creeps in from the upstream lists. */
function normalisePunctuation(text: string): string {
    return text
        .replace(/（/g, '(')
        .replace(/）/g, ')')
        .replace(/，/g, ',')
        .replace(/；/g, ';')
        .replace(/：/g, ':')
}

/**
 * Upstream sometimes repeats the start of a term, e.g. `十天十天干` for 十天干. Only
 * collapse when more CJK follows, so ordinary reduplication (商量商量) survives, and
 * require a unit of two or more characters, so 谢谢 and 看看 are untouched.
 */
function collapseStutter(text: string): string {
    return text.replace(/([\u4e00-\u9fff]{2,4})\1(?=[\u4e00-\u9fff])/g, '$1')
}

/** Drop brackets left unmatched by an upstream typo, rather than displaying them. */
function balanceParentheses(text: string): string {
    const chars = Array.from(text)
    const open: number[] = []
    const drop = new Set<number>()

    chars.forEach((char, index) => {
        if (char === '(') open.push(index)
        else if (char === ')') {
            if (open.length > 0) open.pop()
            else drop.add(index)
        }
    })
    for (const index of open) drop.add(index)

    return chars.filter((_, index) => !drop.has(index)).join('')
}

function cleanSense(sense: string, dropNotes = true): string {
    const cleaned = balanceParentheses(
        collapseStutter(normalisePunctuation(sense.replace(PINYIN_NOTATION, ''))),
    )
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:])/g, '$1')
        .trim()

    return dropNotes && NOTE_SENSE.test(cleaned) ? '' : cleaned
}

export function parseGloss(raw: string): ParsedGloss {
    const classifiers: Classifier[] = []

    for (const annotation of raw.matchAll(CLASSIFIER_ANNOTATION)) {
        // Drop the `CL:` marker itself, otherwise the first item's character class
        // swallows it (the character class permits `:`).
        const body = annotation[0].replace(/^CL:\s*/i, '')
        for (const item of body.matchAll(CLASSIFIER_ITEM)) {
            const char = (item[1] ?? '').trim()
            const pinyinText = (item[2] ?? '').trim()
            if (char && pinyinText) classifiers.push({ char, pinyin: pinyinText })
        }
    }

    const parts = raw.replace(CLASSIFIER_ANNOTATION, '').split(';')
    const defined = parts.map((sense) => cleanSense(sense)).filter((sense) => sense.length > 0)

    // Notes are dropped so they cannot be presented as a definition, but five upstream
    // entries define a character purely by where it turns up - 耶 "used in
    // transliteration", 鑫 "used in names". There the note is the meaning, so keep it
    // rather than shipping an entry with nothing to show.
    const glosses =
        defined.length > 0
            ? defined
            : parts.map((sense) => cleanSense(sense, false)).filter((sense) => sense.length > 0)

    return {
        glosses,
        glossShort: glosses[0] ?? raw.trim(),
        classifiers,
    }
}
