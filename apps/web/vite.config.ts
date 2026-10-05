import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defaultClientConditions } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
		// read @kus/shared from its TS sources, so web needs no shared rebuild in dev;
		// `conditions` replaces Vite's defaults, so they must be kept explicitly
		conditions: ['source', ...defaultClientConditions],
	},
	server: {
		port: 5173,
		strictPort: true,
	},
	build: {
		rolldownOptions: {
			output: {
				// Libraries change rarely: separate chunks stay cached across deploys, so after an
				// update the PWA re-downloads only our own code instead of one 550 kB bundle.
				codeSplitting: {
					groups: [
						{ name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
						{ name: 'vendor-router', test: /node_modules[\\/]react-router[\\/]/ },
						{ name: 'vendor-zod', test: /node_modules[\\/]zod[\\/]/ },
						{ name: 'vendor-data', test: /node_modules[\\/](@tanstack|axios)[\\/]/ },
						{ name: 'vendor-i18n', test: /node_modules[\\/](i18next|react-i18next)[\\/]/ },
					],
				},
			},
		},
	},
	test: {
		include: ['src/**/*.test.{ts,tsx}'],
	},
})
