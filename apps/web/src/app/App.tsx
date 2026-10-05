import { RouterProvider } from 'react-router/dom'

import { AppProviders } from './providers/AppProviders'
import { router } from './router/router'

export const App = () => (
	<AppProviders>
		<RouterProvider router={router} />
	</AppProviders>
)
