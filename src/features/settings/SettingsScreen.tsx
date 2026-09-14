import { useRoute } from '../../app/router'
import { useManifest } from '../../content/useManifest'
import { listIdsFor } from '../../content/wordPool'
import {
    JUN_DA_PRESETS,
    OPTION_COUNT_PRESETS,
    ROUND_LENGTH_PRESETS,
    TIME_LENGTH_PRESETS,
} from '../../domain/constants'
import { LANGUAGE_LABELS } from '../../domain/languages'
import type {
    HskLevel,
    Language,
    LanguageSettings,
    PinyinStyle,
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

export function SettingsScreen() {
    const { settings, update } = useSettings()
    const { available: ttsAvailable } = useTts()
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
                    {/* A small easter egg: 花好月圆 is a blessing ("blooming flowers,
                        a full moon"), and its four syllables happen to be tones
                        1, 3, 4, 2 - so every tone colour appears, each pinyin style
                        reads differently, and the traditional form changes too. */}
                    <span className={styles.previewHan}>
                        {language.characterSet === 'trad' ? '花好月圓' : '花好月圆'}
                    </span>
                    <span className={styles.previewPinyin}>
                        <PinyinText
                            romanization={{
                                scheme: 'pinyin',
                                marked: 'huā hǎo yuè yuán',
                                numbered: 'hua1 hao3 yue4 yuan2',
                                syllables: [
                                    { base: 'hua', marked: 'huā', tone: 1, han: true },
                                    { base: 'hao', marked: 'hǎo', tone: 3, han: true },
                                    { base: 'yue', marked: 'yuè', tone: 4, han: true },
                                    { base: 'yuan', marked: 'yuán', tone: 2, han: true },
                                ],
                            }}
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
                    description={
                        ttsAvailable
                            ? "Uses your device's built-in Mandarin voice."
                            : 'Unavailable — no Chinese voice is installed on this device.'
                    }
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
