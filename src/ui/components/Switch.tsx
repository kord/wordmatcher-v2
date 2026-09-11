import styles from './primitives.module.css'

export interface SwitchProps {
    checked: boolean
    onChange: (checked: boolean) => void
    label: string
    description?: string
}

export function Switch({ checked, onChange, label, description }: SwitchProps) {
    return (
        <div className={styles.switchRow}>
            <div className={styles.rowMain}>
                <div className={styles.rowTitle}>{label}</div>
                {description ? <div className={styles.rowMeta}>{description}</div> : null}
            </div>
            <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                className={styles.switch}
                onClick={() => onChange(!checked)}
            >
                <span className={styles.switchKnob} />
            </button>
        </div>
    )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className={styles.field}>
            <span className={styles.fieldLabel}>{label}</span>
            {children}
        </div>
    )
}
