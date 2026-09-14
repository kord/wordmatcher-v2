import type { Language, StoredSession } from '../domain/types'
import { STORE_SESSIONS, readAll, removeMany, writeMany } from './db'

export async function saveSession(session: StoredSession): Promise<void> {
    await writeMany(STORE_SESSIONS, [session])
}

/** Most recent first, for one variety. */
export async function loadSessions(language: Language, limit = 50): Promise<StoredSession[]> {
    const sessions = await readAll<StoredSession>(STORE_SESSIONS)
    return sessions
        .filter((session) => session.language === language)
        .sort((a, b) => b.startedAt - a.startedAt)
        .slice(0, limit)
}

export async function countSessions(language: Language): Promise<number> {
    const sessions = await readAll<StoredSession>(STORE_SESSIONS)
    return sessions.filter((session) => session.language === language).length
}

/** Erases one variety's history and leaves the other's alone. */
export async function resetSessions(language: Language): Promise<void> {
    const sessions = await readAll<StoredSession>(STORE_SESSIONS)
    const keys = sessions
        .filter((session) => session.language === language)
        .map((session) => session.id)
    await removeMany(STORE_SESSIONS, keys)
}
