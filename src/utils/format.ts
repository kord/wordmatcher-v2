export function formatDuration(ms: number): string {
    const totalSeconds = Math.max(0, Math.round(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes === 0) return `${seconds}s`
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

/** Countdown display, e.g. `4:05`. */
export function formatClock(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatPercent(value: number): string {
    return `${Math.round(value * 100)}%`
}

export function formatCount(value: number): string {
    return value.toLocaleString()
}
