import styles from './primitives.module.css'

export interface ProgressBarProps {
  /** 0 to 1. */
  value: number
  label: string
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))

  return (
    <div
      className={styles.meterTrack}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div className={styles.meterFill} style={{ width: `${clamped * 100}%` }} />
    </div>
  )
}
