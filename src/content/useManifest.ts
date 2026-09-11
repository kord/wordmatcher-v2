import { useEffect, useState } from 'react'
import type { ListManifest } from '../domain/types'
import { loadManifest } from './listLoader'

export interface ManifestState {
    manifest: ListManifest | null
    error: string | null
}

export function useManifest(): ManifestState {
    const [state, setState] = useState<ManifestState>({ manifest: null, error: null })

    useEffect(() => {
        let cancelled = false

        loadManifest()
            .then((manifest) => {
                if (!cancelled) setState({ manifest, error: null })
            })
            .catch((cause: unknown) => {
                if (!cancelled) {
                    setState({
                        manifest: null,
                        error: cause instanceof Error ? cause.message : 'Could not load word lists.',
                    })
                }
            })

        return () => {
            cancelled = true
        }
    }, [])

    return state
}
