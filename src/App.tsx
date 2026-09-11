import { useEffect } from 'react'
import { AppShell } from './app/AppShell'
import { useRoute } from './app/router'
import { HomeScreen } from './features/home/HomeScreen'
import { ProgressScreen } from './features/progress/ProgressScreen'
import { ReviewScreen } from './features/review/ReviewScreen'
import { SessionProvider, useSession } from './features/session/SessionProvider'
import { SessionScreen } from './features/session/SessionScreen'
import { SettingsScreen } from './features/settings/SettingsScreen'
import { SummaryScreen } from './features/summary/SummaryScreen'
import { SettingsProvider } from './ui/hooks/useSettings'

function Routes() {
  const { route, navigate } = useRoute()
  const { phase, summary } = useSession()

  // Guard against deep links (or a stale hash) landing on a screen with no data.
  useEffect(() => {
    const sessionRoutes = route === 'session'
    if (sessionRoutes && phase !== 'playing' && phase !== 'finished' && phase !== 'loading') {
      navigate('home')
    }
    if ((route === 'summary' || route === 'review') && !summary) {
      navigate('home')
    }
  }, [route, phase, summary, navigate])

  switch (route) {
    case 'session':
      return <SessionScreen />
    case 'summary':
      return <SummaryScreen />
    case 'review':
      return <ReviewScreen />
    case 'progress':
      return <ProgressScreen />
    case 'settings':
      return <SettingsScreen />
    default:
      return <HomeScreen />
  }
}

export function App() {
  return (
    <SettingsProvider>
      <SessionProvider>
        <AppShell>
          <Routes />
        </AppShell>
      </SessionProvider>
    </SettingsProvider>
  )
}
