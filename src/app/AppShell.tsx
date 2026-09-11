import type { ReactNode } from 'react'
import shellStyles from './AppShell.module.css'

/**
 * Phone-first shell.
 *
 * `dvh` (with a `vh` fallback) plus safe-area padding fixes the mobile
 * URL-bar jump and notch overlap that the original CSS suffered from, and the
 * centred max-width column keeps tablets from stretching the layout.
 */
export function AppShell({ children }: { children: ReactNode }) {
    return (
        <div className={shellStyles.shell}>
            <div className={shellStyles.inner}>{children}</div>
        </div>
    )
}
