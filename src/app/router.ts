import { useCallback, useEffect, useState } from 'react'

export type RouteName = 'home' | 'session' | 'summary' | 'review' | 'progress' | 'settings'

const ROUTES: RouteName[] = ['home', 'session', 'summary', 'review', 'progress', 'settings']

export function parseHash(hash: string): RouteName {
  const name = hash.replace(/^#\/?/, '').split('?')[0]
  return (ROUTES as string[]).includes(name) ? (name as RouteName) : 'home'
}

export function routeToHash(route: RouteName): string {
  return `#/${route}`
}

/**
 * Hash routing keeps the Android back button and browser history working
 * without shipping a router. There are only six screens.
 */
export function useRoute(): { route: RouteName; navigate: (route: RouteName) => void } {
  const [route, setRoute] = useState<RouteName>(() =>
    parseHash(typeof location === 'undefined' ? '' : location.hash),
  )

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(location.hash))
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = useCallback((next: RouteName) => {
    if (parseHash(location.hash) === next) {
      setRoute(next)
      return
    }
    location.hash = routeToHash(next)
  }, [])

  return { route, navigate }
}
