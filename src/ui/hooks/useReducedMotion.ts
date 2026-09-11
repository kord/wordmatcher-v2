import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function readPreference(): boolean {
    if (typeof matchMedia !== 'function') return false
    return matchMedia(QUERY).matches
}

export function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(readPreference)

    useEffect(() => {
        if (typeof matchMedia !== 'function') return
        const query = matchMedia(QUERY)
        const onChange = () => setReduced(query.matches)
        query.addEventListener('change', onChange)
        return () => query.removeEventListener('change', onChange)
    }, [])

    return reduced
}
