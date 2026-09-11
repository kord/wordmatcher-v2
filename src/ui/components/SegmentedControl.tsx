import styles from './primitives.module.css'

export interface SegmentedOption<T extends string | number> {
    value: T
    label: string
}

export interface SegmentedControlProps<T extends string | number> {
    value: T
    options: readonly SegmentedOption<T>[]
    onChange: (value: T) => void
    label: string
    className?: string
}

export function SegmentedControl<T extends string | number>({
    value,
    options,
    onChange,
    label,
    className,
}: SegmentedControlProps<T>) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={[styles.segmented, className ?? ''].filter(Boolean).join(' ')}
        >
            {options.map((option) => (
                <button
                    key={String(option.value)}
                    type="button"
                    role="radio"
                    aria-checked={option.value === value}
                    className={styles.segment}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    )
}
