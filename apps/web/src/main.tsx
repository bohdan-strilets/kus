import './app/styles/global.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { setupStaleChunkReload } from './app/providers/reload-on-stale-chunk'

setupStaleChunkReload()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element #root not found')

createRoot(rootElement).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
