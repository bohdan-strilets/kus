import { RouterProvider } from 'react-router/dom'

import { httpClient } from '@/shared/api'

import { AppProviders } from './providers/AppProviders'
import { queryClient } from './providers/query-client'
import { setupSession } from './providers/setup-session'
import { syncOutboxOwner } from './providers/sync-outbox-owner'
import { router } from './router/router'

// once per page load, before the first request: every API call gets the silent refresh
setupSession({ client: httpClient, queryClient })
syncOutboxOwner(queryClient)

export const App = () => (
	<AppProviders>
		<RouterProvider router={router} />
	</AppProviders>
)
