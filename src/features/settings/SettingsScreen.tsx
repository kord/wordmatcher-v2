import { useRoute } from '../../app/router'
import {
    JUN_DA_PRESETS,
    OPTION_COUNT_PRESETS,
    ROUND_LENGTH_PRESETS,
    TIME_LENGTH_PRESETS,
} from '../../domain/constants'
import type { HskLevel, PinyinStyle, ThemePreference } from '../../domain/types'
import { Button } from '../../ui/components/Button'
import { PinyinText } from '../../ui/components/PinyinText'
import { Screen } from '../../ui/components/Screen'
import { SegmentedControl } from '../../ui/components/SegmentedControl'
import { Field, Switch } from '../../ui/components/Switch'
import { useSettings } from '../../ui/hooks/useSettings'
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

const THEMES: { value: ThemePreference; label: string }[] = [
    { value: 'system', label: 'System' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
]

export function SettingsScreen() {
    const { settings, update } = useSettings()
    const { navigate } = useRoute()
    const { quit } = useSession()

    const selection = settings.selection

    const handleResetProgress = () => {
        if (!window.confirm('Erase all word progress? This cannot be undone.')) return
        void resetProgress()
    }

    const handleResetSessions = () => {
        if (!window.confirm('Erase your session history?')) return
        void resetSessions()
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
                <h2 className={styles.groupTitle}>Word list</h2>

                <Field label="Source">
                    <SegmentedControl
                        label="Word list source"
                        value={selection.kind}
                        options={[
                            { value: 'hsk', label: 'HSK' },
                            { value: 'junda', label: 'Jun Da' },
                        ]}
                        onChange={(kind) =>
                            update({
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
                                options={HSK_LEVELS}
                                onChange={(level) =>
                                    update({ selection: { kind: 'hsk', level, includeLower: selection.includeLower } })
                                }
                            />
                        </Field>
                        <Switch
                            label="Include easier levels"
                            description="Mix in every level below the one selected."
                            checked={selection.includeLower}
                            onChange={(includeLower) =>
                                update({ selection: { kind: 'hsk', level: selection.level, includeLower } })
                            }
                        />
                    </>
                ) : (
                    <Field label="Frequency range">
                        <SegmentedControl
                            label="Jun Da range"
                            value={selection.maxRank}
                            options={JUN_DA_PRESETS.map((rank) => ({ value: rank, label: `${rank}` }))}
                            onChange={(maxRank) => update({ selection: { kind: 'junda', maxRank } })}
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
                <h2 className={styles.groupTitle}>Characters and pinyin</h2>

                <Field label="Character set">
                    <SegmentedControl
                        label="Character set"
                        value={settings.characterSet}
                        options={[
                            { value: 'simp', label: 'Simplified' },
                            { value: 'trad', label: 'Traditional' },
                        ]}
                        onChange={(characterSet) => update({ characterSet })}
                    />
                </Field>

                <Field label="Pinyin style">
                    <SegmentedControl
                        label="Pinyin style"
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
                    <span className={styles.previewHan}>
                        {settings.characterSet === 'trad' ? '學習' : '学习'}
                    </span>
                    <span className={styles.previewPinyin}>
                        <PinyinText
                            pinyin={{
                                marked: 'xué xí',
                                numbered: 'xue2 xi2',
                                syllables: [
                                    { base: 'xue', marked: 'xué', tone: 2, han: true },
                                    { base: 'xi', marked: 'xí', tone: 2, han: true },
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
                    description="Uses your device's built-in Mandarin voice."
                    checked={settings.sound}
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
                    Character Frequency List. Pinyin generated with{' '}
                    <a href="https://github.com/zh-lx/pinyin-pro" rel="noreferrer noopener" target="_blank">
                        pinyin-pro
                    </a>
                    ; traditional forms converted with{' '}
                    <a href="https://github.com/nk2028/opencc-js" rel="noreferrer noopener" target="_blank">
                        opencc-js
                    </a>
                    . Definitions resemble CC-CEDICT content — check the upstream licences before redistributing.
                </p>
            </section>
        </Screen>
    )
}
