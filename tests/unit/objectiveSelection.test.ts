import { describe, expect, it } from 'vitest'
import { ALL_OBJECTIVES, CONTRAST_OBJECTIVE, OBJECTIVES } from '../../src/domain/constants'
import { askableObjectives, chooseObjective, objectivesFor } from '../../src/domain/objectives'
import { mulberry32 } from '../../src/domain/rng'
import type { Objective, WordEntry } from '../../src/domain/types'
import { defaultSettings, normalizeSettings } from '../../src/storage/settings'
import { makeEntry, makePinyin } from './fixtures'

/**
 * The question-type panel lets a player turn types off, and one rule has to hold whatever they
 * do: a session always has something to ask. There are two places that could break it - the
 * chooser, if it honours an enabled set that does not overlap what the word can be asked, and the
 * store, if an empty set is accepted - so both are checked here.
 */

/** A Taiwanese word written differently from its Mandarin counterpart. */
const contrastable = (): WordEntry =>
    makeEntry({
        simp: '蛋',
        trad: '卵',
        language: 'taiwanese',
        mandarin: {
            simp: '蛋',
            trad: '蛋',
            glossShort: 'egg',
            pinyin: makePinyin('dan4'),
            differs: 'word',
        },
    })

/** A Taiwanese word whose characters match Mandarin, so there is no contrast to ask. */
const sameAsMandarin = (): WordEntry =>
    makeEntry({
        simp: '肉',
        trad: '肉',
        language: 'taiwanese',
        mandarin: {
            simp: '肉',
            trad: '肉',
            glossShort: 'meat',
            pinyin: makePinyin('rou4'),
            differs: 'reading',
        },
    })

const plainMandarin = (): WordEntry => makeEntry({ simp: '爱' })

/** Run the chooser many times and collect what it produces. */
function sampled(entry: WordEntry, enabled?: Objective[]): Set<Objective> {
    const rng = mulberry32(7)
    const seen = new Set<Objective>()
    for (let index = 0; index < 400; index += 1) seen.add(chooseObjective(rng, entry, enabled))
    return seen
}

describe('objectivesFor', () => {
    it('offers the contrast drill only where the characters differ', () => {
        expect(objectivesFor(contrastable())).toContain(CONTRAST_OBJECTIVE)
        expect(objectivesFor(sameAsMandarin())).not.toContain(CONTRAST_OBJECTIVE)
        expect(objectivesFor(plainMandarin())).not.toContain(CONTRAST_OBJECTIVE)
    })

    it('offers every objective to a word that qualifies, in the panel order', () => {
        expect(objectivesFor(contrastable())).toEqual(ALL_OBJECTIVES)
    })
})

describe('askableObjectives', () => {
    it('is the whole set when nothing has been turned off', () => {
        expect(askableObjectives(contrastable())).toEqual(ALL_OBJECTIVES)
        expect(askableObjectives(contrastable(), [])).toEqual(ALL_OBJECTIVES)
        expect(askableObjectives(plainMandarin(), OBJECTIVES)).toEqual(OBJECTIVES)
    })

    it('narrows to the enabled types', () => {
        expect(askableObjectives(contrastable(), ['zh-en', 'zh-tw'])).toEqual(['zh-en', 'zh-tw'])
    })

    it('ignores an enabled type this word cannot be asked', () => {
        // The contrast drill is enabled, but this word has no Mandarin counterpart to show.
        expect(askableObjectives(sameAsMandarin(), ['zh-en', CONTRAST_OBJECTIVE])).toEqual(['zh-en'])
    })

    it('falls back to the word rather than returning nothing when the two do not overlap', () => {
        // The player left only the contrast drill on and this word cannot be asked it. Asking
        // something beats a session that cannot build a question, but the fallback must still be
        // the word's own set, so the contrast drill is not smuggled back in for a word that does
        // not qualify.
        const fallback = askableObjectives(sameAsMandarin(), [CONTRAST_OBJECTIVE])

        expect(fallback).toEqual(OBJECTIVES)
        expect(fallback).not.toContain(CONTRAST_OBJECTIVE)
    })
})

describe('chooseObjective', () => {
    it('asks every type when nothing is turned off', () => {
        expect(sampled(contrastable())).toEqual(new Set(ALL_OBJECTIVES))
    })

    it('never asks a type the player turned off', () => {
        const enabled: Objective[] = ['zh-pinyin', 'zh-tw']
        const seen = sampled(contrastable(), enabled)

        expect(seen).toEqual(new Set(enabled))
    })

    it('still asks something when only the contrast drill is on and the word does not qualify', () => {
        const seen = sampled(sameAsMandarin(), [CONTRAST_OBJECTIVE])

        expect(seen.size).toBeGreaterThan(0)
        expect([...seen].every((objective) => OBJECTIVES.includes(objective))).toBe(true)
    })
})

describe('the stored set', () => {
    it('starts with everything on for both varieties', () => {
        const defaults = defaultSettings()

        expect(defaults.byLanguage.mandarin.objectives).toEqual(OBJECTIVES)
        expect(defaults.byLanguage.taiwanese.objectives).toEqual(ALL_OBJECTIVES)
    })

    it('keeps a valid subset', () => {
        const stored = normalizeSettings({ byLanguage: { mandarin: { objectives: ['en-zh'] } } })

        expect(stored.byLanguage.mandarin.objectives).toEqual(['en-zh'])
    })

    it('refuses an empty set, because a session with no question types has nothing to ask', () => {
        const stored = normalizeSettings({ byLanguage: { mandarin: { objectives: [] } } })

        expect(stored.byLanguage.mandarin.objectives).toEqual(OBJECTIVES)
    })

    it('drops ids it does not recognise and re-orders the rest', () => {
        const stored = normalizeSettings({
            byLanguage: { mandarin: { objectives: ['zh-tw', 'made-up', 'en-zh'] } },
        })

        // 'zh-tw' is dropped for Mandarin, and the survivor is normalised to the panel order
        // rather than the order it arrived in.
        expect(stored.byLanguage.mandarin.objectives).toEqual(['en-zh'])
    })

    it('falls back when the field is missing or the wrong shape', () => {
        expect(normalizeSettings({}).byLanguage.mandarin.objectives).toEqual(OBJECTIVES)
        expect(normalizeSettings({ byLanguage: { mandarin: { objectives: 'zh-en' } } }).byLanguage.mandarin.objectives).toEqual(
            OBJECTIVES,
        )
    })
})
