import type { AuthUser } from '@kus/shared'
import { useQuery } from '@tanstack/react-query'

import { sessionQueryOptions } from './session-query'

/** The signed-in user (name, timezone); null only outside the protected routes. */
export const useSessionUser = (): AuthUser | null => useQuery(sessionQueryOptions).data ?? null
