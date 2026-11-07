export type LiveNetPhase = 'hidden' | 'offline' | 'syncing' | 'saved'

/** «Збережено» stays this long after the connection came back, then fades out. */
export const SAVED_VISIBLE_MS = 2_000
