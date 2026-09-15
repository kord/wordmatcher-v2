import { useRoute } from '../../app/router'
import { useManifest } from '../../content/useManifest'
import { listIdsFor } from '../../content/wordPool'
import {
    ALL_OBJECTIVES,
    JUN_DA_PRESETS,
    OBJECTIVES,
    OPTION_COUNT_PRESETS,
    ROUND_LENGTH_PRESETS,
    TIME_LENGTH_PRESETS,
} from '../../domain/constants'
import { objectiveLabel, taskHintFor } from '../../domain/faces'
import { LANGUAGE_LABELS } from '../../domain/languages'
import type {
    HskLevel,
    Language,
    LanguageSettings,
    Objective,
    PinyinStyle,
    Romanization,
    RomanizationScheme,
    ThemePreference,
} from '../../domain/types'
import { Button } from '../../ui/components/Button'
import { PinyinText } from '../../ui/components/PinyinText'
import { Screen } from '../../ui/components/Screen'
import { SegmentedControl } from '../../ui/components/SegmentedControl'
import { Field, Switch } from '../../ui/components/Switch'
import { useSettings } from '../../ui/hooks/useSettings'
import { useTts } from '../../ui/hooks/useTts'
import type { VoiceFit } from '../../ui/hooks/voiceChoice'
import { resetProgress } from '../../storage/progressRepo'
import { resetSessions } from '../../storage/sessionRepo'
import { useSession } from '../session/SessionProvider'
import styles from './settings.module.css'

const HSK_LEVELS: { value: HskLevel; label: string }[] = [
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
    { value: 5, label: '5' },
    { value: 6, label: '6' },
]

const PINYIN_STYLES: { value: PinyinStyle; label: string }[] = [
    { value: 'diacritic', label: 'Diacritics' },
    { value: 'numbers', label: 'Numbers' },
    { value: 'superscript', label: 'Superscript' },
]

const LANGUAGES: { value: Language; label: string }[] = [
    { value: 'mandarin', label: LANGUAGE_LABELS.mandarin },
    { value: 'taiwanese', label: LANGUAGE_LABELS.taiwanese },
]

/** Tai-lo is what Taiwan's education ministry uses; POJ is what most older dictionaries print. */
const TAIWANESE_SCHEMES: { value: RomanizationScheme; label: string }[] = [
    { value: 'tailo', label: 'Tâi-lô' },
    { value: 'poj', label: 'POJ' },
]

const THEMES: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
]

/**
 * The preview sample, chosen so that the tone colours have something to show.
 *
 * 花好月圓 is a blessing - blooming flowers, a full moon - and read either way its four
 * syllables fall on four different tones. In pinyin that is 1, 3, 4, 2; in Tâi-lô it is
 * `hue-hó-gue̍h-guân`, which is 1, 2, 8 and 5, so it reaches the two tones Tâi-lô has that
 * pinyin does not. In POJ the same word is `hoe-hó-goe̍h-goân`: the same four tones, and the
 * four spellings that separate the two schemes, so switching romanisation shows the switch.
 *
 * That matters beyond the sample: while this only ever showed pinyin, a missing colour for
 * tones 5, 7 and 8 was invisible to the people who would have seen it, and while it only ever
 * showed Tâi-lô, choosing POJ appeared to change nothing.
 */
const MANDARIN_PREVIEW: Romanization = {
    scheme: 'pinyin',
    marked: 'huā hǎo yuè yuán',
    numbered: 'hua1 hao3 yue4 yuan2',
    syllables: [
        { base: 'hua', marked: 'huā', tone: 1, han: true },
        { base: 'hao', marked: 'hǎo', tone: 3, han: true },
        { base: 'yue', marked: 'yuè', tone: 4, han: true },
        { base: 'yuan', marked: 'yuán', tone: 2, han: true },
    ],
}

const TAIWANESE_PREVIEW: Record<'tailo' | 'poj', Romanization> = {
    tailo: {
        scheme: 'tailo',
        marked: 'hue-hó-gue̍h-guân',
        numbered: 'hue1 ho2 gueh8 guan5',
        syllables: [
            { base: 'hue', marked: 'hue', tone: 1, han: true },
            { base: 'ho', marked: 'hó', tone: 2, han: true },
            { base: 'gueh', marked: 'gue̍h', tone: 8, han: true },
            { base: 'guan', marked: 'guân', tone: 5, han: true },
        ],
    },
    poj: {
        scheme: 'poj',
        marked: 'hoe-hó-goe̍h-goân',
        numbered: 'hoe1 ho2 goeh8 goan5',
        syllables: [
            { base: 'hoe', marked: 'hoe', tone: 1, han: true },
            { base: 'ho', marked: 'hó', tone: 2, han: true },
            { base: 'goeh', marked: 'goe̍h', tone: 8, han: true },
            { base: 'goan', marked: 'goân', tone: 5, han: true },
        ],
    },
}

/** Tâi-lô unless POJ was asked for; a pinyin scheme never reaches this. */
const taiwanesePreview = (scheme: RomanizationScheme): Romanization =>
    scheme === 'poj' ? TAIWANESE_PREVIEW.poj : TAIWANESE_PREVIEW.tailo

/** Keeps the stored set in one order, whatever order the switches were flipped in. */
const inCanonicalOrder = (objectives: Objective[]): Objective[] =>
    ALL_OBJECTIVES.filter((objective) => objectives.includes(objective))

/**
 * What the speech switch says, which depends on what the device can actually do.
 *
 * A Taiwanese voice is rare, so Taiwanese falls back to a Mandarin voice rather than going
 * silent. That is worth having, but it gives Taiwanese words their Mandarin readings - 卵 comes
 * out `luǎn` where the answer is `nn̄g` - so the fallback is named as a stand-in and the player
 * is told what to install, rather than being left to learn a reading that is wrong.
 */
function speechDescription(language: Language, available: boolean, fit: VoiceFit | null): string {
    if (!available) return 'Unavailable — no Chinese voice is installed on this device.'
    if (fit === 'approximate') {
        return 'Reads each answer with a Mandarin voice, so Taiwanese words get Mandarin readings. Add a Taiwanese (Min Nan) voice in your device’s text-to-speech settings to hear them properly.'
    }
    return language === 'taiwanese'
        ? 'Reads each answer aloud with your Taiwanese voice.'
        : "Reads each answer aloud with your device's Chinese voice."
}

/**
 * Which question types to ask, one switch each.
 *
 * Per variety, because the contrast drill exists only for Taiwanese: offering it to a Mandarin
 * player would be a switch that can never do anything, since the prompt it needs is the Mandarin
 * counterpart itself.
 *
 * The last switch left on cannot be turned off. A session with no question types has nothing to
 * ask, so rather than allowing that and failing when the session starts, the remaining switch is
 * disabled and the section says why. `normalizeSettings` refuses an empty set too, which covers a
 * store written by an older build or edited by hand.
 */
function QuestionTypes({
    language,
    enabled,
    onChange,
}: {
    language: Language
    enabled: Objective[]
    onChange: (objectives: Objective[]) => void
}) {
    const offered = language === 'taiwanese' ? ALL_OBJECTIVES : OBJECTIVES

    return (
        <section className={styles.group}>
            <h2 className={styles.groupTitle}>Question types</h2>

            <p className={styles.groupNote}>
                Turn off the question types you do not want. At least one stays on.
            </p>

            {offered.map((objective) => {
                const on = enabled.includes(objective)
                return (
                    <Switch
                        key={objective}
                        label={objectiveLabel(objective)}
                        // The exact instruction shown above the prompt in a session, so the
                        // panel says what the question will look like rather than restating the
                        // label.
                        description={taskHintFor(objective)}
                        checked={on}
                        disabled={on && enabled.length <= 1}
                        onChange={(next) =>
                            onChange(
                                inCanonicalOrder(
                                    next
                                        ? [...enabled, objective]
                                        : enabled.filter((item) => item !== objective),
                                ),
                            )
                        }
                    />
                )
            })}
        </section>
    )
}

export function SettingsScreen() {
    const { settings, update } = useSettings()
    const { available: ttsAvailable, fit: ttsFit } = useTts(settings.language)
    const { navigate } = useRoute()
    const { quit } = useSession()
    const { manifest } = useManifest()

    const language = settings.byLanguage[settings.language]
    const selection = language.selection

    // Only offer levels that exist for the chosen variety, so the app cannot be pointed at a
    // list that has not been built. It matters now because Taiwanese is being built one
    // level at a time, and it will matter again when Cantonese arrives. Until the manifest
    // has loaded every level is offered, and starting a session surfaces the real error.
    const levelOptions = HSK_LEVELS.filter((option) => {
        if (!manifest) return true
        const [id] = listIdsFor(
            { kind: 'hsk', level: option.value, includeLower: false },
            settings.language,
        )
        return manifest.lists.some((list) => list.id === id)
    })

    // Choices live per variety, so every edit writes into the active one rather than
    // replacing a single shared value. Switching languages therefore cannot disturb the
    // other language's setup.
    const updateLanguage = (patch: Partial<LanguageSettings>) =>
        update({
            byLanguage: {
                ...settings.byLanguage,
                [settings.language]: { ...language, ...patch },
            },
        })

    const handleResetProgress = () => {
        if (!window.confirm(`Erase ${LANGUAGE_LABELS[settings.language]} word progress?`)) return
        void resetProgress(settings.language)
    }

    const handleResetSessions = () => {
        if (!window.confirm(`Erase your ${LANGUAGE_LABELS[settings.language]} session history?`)) return
        void resetSessions(settings.language)
    }

    return (
        <Screen
            title="Settings"
            onBack={() => navigate('home')}
            headerActions={
                <Button variant="ghost" onClick={() => navigate('home')}>
                    Done
                </Button>
            }
        >
            <section className={styles.group}>
                <h2 className={styles.groupTitle}>What you are practising</h2>

                <Field label="Language">
                    <SegmentedControl
                        label="Language"
                        value={settings.language}
                        options={LANGUAGES}
                        onChange={(next) => update({ language: next })}
                    />
                </Field>

                <Field label="Source">
                    <SegmentedControl
                        label="Word list source"
                        value={selection.kind}
                        // Jun Da is a Mandarin character-frequency list with no Taiwanese
                        // counterpart, so it is not offered rather than quietly resolving to
                        // something else.
                        options={
                            settings.language === 'taiwanese'
                                ? [{ value: 'hsk' as const, label: 'HSK' }]
                                : [
                                    { value: 'hsk' as const, label: 'HSK' },
                                    { value: 'junda' as const, label: 'Jun Da' },
                                ]
                        }
                        onChange={(kind) =>
                            updateLanguage({
                                selection:
                                    kind === 'hsk'
                                        ? { kind: 'hsk', level: 1, includeLower: false }
                                        : { kind: 'junda', maxRank: 500 },
                            })
                        }
                    />
                </Field>

                {selection.kind === 'hsk' ? (
                    <>
                        <Field label="HSK level">
                            <SegmentedControl
                                label="HSK level"
                                value={selection.level}
                                options={levelOptions}
                                onChange={(level) =>
                                    updateLanguage({
                                        selection: {
                                            kind: 'hsk',
                                            level,
                                            includeLower: selection.includeLower,
                                        },
                                    })
                                }
                            />
                        </Field>
                        <Switch
                            label="Include easier levels"
                            description="Mix in every level below the one selected."
                            checked={selection.includeLower}
                            onChange={(includeLower) =>
                                updateLanguage({
                                    selection: { kind: 'hsk', level: selection.level, includeLower },
                                })
                            }
                        />
                    </>
                ) : (
                    <Field label="Frequency range">
                        <SegmentedControl
                            label="Jun Da range"
                            value={selection.maxRank}
                            options={JUN_DA_PRESETS.map((rank) => ({ value: rank, label: `${rank}` }))}
                            onChange={(maxRank) => updateLanguage({ selection: { kind: 'junda', maxRank } })}
                        />
                    </Field>
                )}
            </section>

            <QuestionTypes
                language={settings.language}
                enabled={language.objectives}
                onChange={(objectives) => updateLanguage({ objectives })}
            />

            <section className={styles.group}>
                <h2 className={styles.groupTitle}>Session</h2>

                <Field label="Length mode">
                    <SegmentedControl
                        label="Session length mode"
                        value={settings.length.unit}
                        options={[
                            { value: 'rounds', label: 'Rounds' },
                            { value: 'time', label: 'Timed' },
                        ]}
                        onChange={(unit) =>
                            update({
                                length:
                                    unit === 'rounds'
                                        ? { unit: 'rounds', value: ROUND_LENGTH_PRESETS[1] }
                                        : { unit: 'time', value: TIME_LENGTH_PRESETS[1] },
                            })
                        }
                    />
                </Field>

                {settings.length.unit === 'rounds' ? (
                    <Field label="Questions">
                        <SegmentedControl
                            label="Number of questions"
                            value={settings.length.value}
                            options={ROUND_LENGTH_PRESETS.map((value) => ({ value, label: `${value}` }))}
                            onChange={(value) => update({ length: { unit: 'rounds', value } })}
                        />
                    </Field>
                ) : (
                    <Field label="Minutes">
                        <SegmentedControl
                            label="Session minutes"
                            value={settings.length.value}
                            options={TIME_LENGTH_PRESETS.map((value) => ({
                                value,
                                label: `${Math.round(value / 60)}m`,
                            }))}
                            onChange={(value) => update({ length: { unit: 'time', value } })}
                        />
                    </Field>
                )}

                <Field label="Answer options">
                    <SegmentedControl
                        label="Number of answer options"
                        value={settings.optionCount}
                        options={OPTION_COUNT_PRESETS.map((value) => ({ value, label: `${value}` }))}
                        onChange={(optionCount) => update({ optionCount })}
                    />
                </Field>
            </section>

            <section className={styles.group}>
                <h2 className={styles.groupTitle}>Characters and reading</h2>

                {/* Taiwanese is written in traditional characters only and is never
                    romanised with pinyin, so each variety gets the control that applies to
                    it rather than the same two rows with one greyed out. */}
                {settings.language === 'mandarin' ? (
                    <Field label="Character set">
                        <SegmentedControl
                            label="Character set"
                            value={language.characterSet}
                            options={[
                                { value: 'simp', label: 'Simplified' },
                                { value: 'trad', label: 'Traditional' },
                            ]}
                            onChange={(characterSet) => updateLanguage({ characterSet })}
                        />
                    </Field>
                ) : (
                    <Field label="Romanisation">
                        <SegmentedControl
                            label="Romanisation"
                            value={language.romanization}
                            options={TAIWANESE_SCHEMES}
                            onChange={(romanization) => updateLanguage({ romanization })}
                        />
                    </Field>
                )}

                <Field label="Reading style">
                    <SegmentedControl
                        label="Reading style"
                        value={settings.pinyinDisplay.style}
                        options={PINYIN_STYLES}
                        onChange={(style) => update({ pinyinDisplay: { ...settings.pinyinDisplay, style } })}
                    />
                </Field>

                <Switch
                    label="Colour syllables by tone"
                    description="Works alongside any pinyin style."
                    checked={settings.pinyinDisplay.toneColours}
                    onChange={(toneColours) =>
                        update({ pinyinDisplay: { ...settings.pinyinDisplay, toneColours } })
                    }
                />

                <div className={styles.preview}>
                    {/* Same blessing in both varieties, traditional or simplified by setting.
                        See the samples above for what its four tones are. */}
                    <span className={styles.previewHan}>
                        {language.characterSet === 'trad' ? '花好月圓' : '花好月圆'}
                    </span>
                    <span className={styles.previewPinyin}>
                        <PinyinText
                            romanization={
                                settings.language === 'taiwanese'
                                    ? taiwanesePreview(language.romanization)
                                    : MANDARIN_PREVIEW
                            }
                            style={settings.pinyinDisplay.style}
                            toneColours={settings.pinyinDisplay.toneColours}
                        />
                    </span>
                </div>
            </section>

            <section className={styles.group}>
                <h2 className={styles.groupTitle}>Feedback</h2>

                <Switch
                    label="Advance automatically"
                    description="Turn off to step through each answer with a tap."
                    checked={settings.autoAdvance}
                    onChange={(autoAdvance) => update({ autoAdvance })}
                />

                <Switch
                    label="Speak the answer"
                    description={speechDescription(settings.language, ttsAvailable, ttsFit)}
                    checked={settings.sound && ttsAvailable}
                    disabled={!ttsAvailable}
                    onChange={(sound) => update({ sound })}
                />

                <Switch
                    label="Vibration"
                    description="Android only — iOS Safari does not support it."
                    checked={settings.haptics}
                    onChange={(haptics) => update({ haptics })}
                />
            </section>

            <section className={styles.group}>
                <h2 className={styles.groupTitle}>Appearance</h2>
                <Field label="Theme">
                    <SegmentedControl
                        label="Theme"
                        value={settings.theme}
                        options={THEMES}
                        onChange={(theme) => update({ theme })}
                    />
                </Field>
            </section>

            <section className={styles.group}>
                <h2 className={styles.groupTitle}>Data</h2>
                <div className={styles.dangerRow}>
                    <Button variant="danger" onClick={handleResetProgress}>
                        Reset progress
                    </Button>
                    <Button variant="danger" onClick={handleResetSessions}>
                        Clear history
                    </Button>
                </div>
                <Button
                    variant="ghost"
                    onClick={() => {
                        quit()
                        navigate('home')
                    }}
                >
                    Abandon current session
                </Button>
            </section>

            <section className={styles.group}>
                <h2 className={styles.groupTitle}>Sources</h2>
                <p className={styles.attribution}>
                    Vocabulary from the HSK lists via hsk.academy; frequency data from Jun Da's Modern Chinese
                    Character Frequency List. Definitions from{' '}
                    <a href="https://cc-cedict.org/" rel="noreferrer noopener" target="_blank">
                        CC-CEDICT
                    </a>
                    , used under{' '}
                    <a
                        href="https://creativecommons.org/licenses/by-sa/4.0/"
                        rel="noreferrer noopener"
                        target="_blank"
                    >
                        CC BY-SA 4.0
                    </a>
                    . Pinyin regenerated with{' '}
                    <a href="https://github.com/zh-lx/pinyin-pro" rel="noreferrer noopener" target="_blank">
                        pinyin-pro
                    </a>
                    ; traditional forms converted with{' '}
                    <a href="https://github.com/nk2028/opencc-js" rel="noreferrer noopener" target="_blank">
                        opencc-js
                    </a>
                    ; entries de-duplicated and glosses shortened. Taiwanese readings from the 臺華雙語辭典
                    via{' '}
                    <a
                        href="https://github.com/ChhoeTaigi/ChhoeTaigiDatabase"
                        rel="noreferrer noopener"
                        target="_blank"
                    >
                        ChhoeTaigi
                    </a>
                    , used under the same licence. The app's own code is MIT licensed.
                </p>
            </section>
        </Screen>
    )
}
