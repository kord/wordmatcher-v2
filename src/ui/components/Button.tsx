import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './primitives.module.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant
    block?: boolean
    children: ReactNode
}

export function Button({ variant = 'secondary', block = false, className, children, ...rest }: ButtonProps) {
    return (
        <button
            type="button"
            className={[styles.button, styles[variant], block ? styles.block : '', className ?? '']
                .filter(Boolean)
                .join(' ')}
            {...rest}
        >
            {children}
        </button>
    )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    label: string
    children: ReactNode
}

export function IconButton({ label, className, children, ...rest }: IconButtonProps) {
    return (
        <button
            type="button"
            aria-label={label}
            className={[styles.iconButton, className ?? ''].filter(Boolean).join(' ')}
            {...rest}
        >
            {children}
        </button>
    )
}
