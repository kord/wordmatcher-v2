import type { ReactNode } from 'react'
import { IconButton } from './Button'
import styles from './primitives.module.css'

export interface ScreenProps {
    title: string
    subtitle?: string
    onBack?: () => void
    headerActions?: ReactNode
    children: ReactNode
    footer?: ReactNode
    /** Use when the child manages its own internal scrolling. */
    flush?: boolean
}

export function Screen({
    title,
    subtitle,
    onBack,
    headerActions,
    children,
    footer,
    flush = false,
}: ScreenProps) {
    return (
        <div className={styles.screen}>
            <header className={styles.header}>
                {onBack ? (
                    <IconButton label="Go back" onClick={onBack}>
                        <span aria-hidden="true">←</span>
                    </IconButton>
                ) : (
                    <span />
                )}
                <div className={styles.headerText}>
                    <div className={styles.title}>{title}</div>
                    {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
                </div>
                {headerActions ?? <span />}
            </header>

            <div className={[styles.body, flush ? styles.bodyFlush : ''].filter(Boolean).join(' ')}>
                {children}
            </div>

            {footer ? <div className={styles.footer}>{footer}</div> : null}
        </div>
    )
}
