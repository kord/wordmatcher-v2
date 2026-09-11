import type { Classifier } from '../../src/domain/types.ts'

/**
 * Upstream glosses are CC-CEDICT style, e.g.
 *   `to love; affection; CL:个[ge4] ,位[wei4]`
 * We keep every sense but lift the classifier annotations into structured data.
 */
const CLASSIFIER_ANNOTATION = /CL:\s*[^;]*/gi
const CLASSIFIER_ITEM = /([^\s,[\]]+)\[([^\]]+)\]/g

export interface ParsedGloss {
  glosses: string[]
  glossShort: string
  classifiers: Classifier[]
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

  const glosses = raw
    .replace(CLASSIFIER_ANNOTATION, '')
    .split(';')
    .map((sense) => sense.replace(/\s+/g, ' ').trim())
    .filter((sense) => sense.length > 0)

  return {
    glosses,
    glossShort: glosses[0] ?? raw.trim(),
    classifiers,
  }
}
