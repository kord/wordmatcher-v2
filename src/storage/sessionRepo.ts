import type { StoredSession } from '../domain/types'
import { STORE_SESSIONS, clearStore, readAll, writeMany } from './db'

export async function saveSession(session: StoredSession): Promise<void> {
    await writeMany(STORE_SESSIONS, [session])
}

/** Most recent first. */
export async function loadSessions(limit = 50): Promise<StoredSession[]> {
    const sessions = await readAll<StoredSession>(STORE_SESSIONS)
    return sessions.sort((a, b) => b.startedAt - a.startedAt).slice(0, limit)
}

export async function countSessions(): Promise<number> {
    return (await readAll<StoredSession>(STORE_SESSIONS)).length
}

export async function resetSessions(): Promise<void> {
    await clearStore(STORE_SESSIONS)
}
