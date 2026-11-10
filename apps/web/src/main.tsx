import './app/styles/global.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { setupServiceWorker } from './app/providers/register-service-worker'
import { setupStaleChunkReload } from './app/providers/reload-on-stale-chunk'

setupStaleChunkReload()
setupServiceWorker()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

createRoot(rootElement).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
