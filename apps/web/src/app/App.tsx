import { RouterProvider } from 'react-router/dom'

import { consumePendingLoginPush } from '@/features/logout'
import { httpClient } from '@/shared/api'
import { ROUTES } from '@/shared/config'

import { AppProviders } from './providers/AppProviders'
import { queryClient } from './providers/query-client'
import { setupSession } from './providers/setup-session'
import { syncOutboxOwner } from './providers/sync-outbox-owner'
import { router } from './router/router'

// once per page load, before the first request: every API call gets the silent refresh
setupSession({ client: httpClient, queryClient })
syncOutboxOwner(queryClient)
// a logout's walk back landed in an earlier document: finish it, dropping the app entries ahead
if (consumePendingLoginPush()) void router.navigate(ROUTES.login)

export const App = () => (
	<AppProviders>
		<RouterProvider router={router} />
	</AppProviders>
)
