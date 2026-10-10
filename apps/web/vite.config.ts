import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defaultClientConditions } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Middle stop of the bg-app gradient (shared/ui/theme/tokens.css), as design/README.md specifies
// for the manifest: the splash screen of the installed app
const APP_BACKGROUND_COLOR = '#FBF6EE'
// The top of bg-app (--color-app-top): the status bar / browser toolbar continue the screen instead
// of a white strip; keep in sync with <meta name="theme-color"> in index.html
const APP_THEME_COLOR = '#FCEBD8'
// `pnpm --filter api dev` (PORT in apps/api/.env.example)
const API_DEV_TARGET = 'http://localhost:3000'

const { version } = JSON.parse(
	readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

export default defineConfig({
	// the «Kusik · версія 0.1» line in Settings (__APP_VERSION__ in src/vite-env.d.ts)
	define: { __APP_VERSION__: JSON.stringify(version) },
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
			manifest: {
				name: 'Kusik',
				short_name: 'Kusik',
				lang: 'uk',
				start_url: '/',
				display: 'standalone',
				orientation: 'portrait',
				theme_color: APP_THEME_COLOR,
				background_color: APP_BACKGROUND_COLOR,
				icons: [
					{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
					{
						src: '/icon-maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
				// API calls go same-origin through the rewrite: never answer them with the SPA shell
				navigateFallbackDenylist: [/^\/api\//],
			},
		}),
	],
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
		// same origin as production (the Vercel /api rewrite): first-party cookies, no CORS
		proxy: {
			'/api': API_DEV_TARGET,
		},
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
						{
							name: 'vendor-motion',
							test: /node_modules[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/,
						},
					],
				},
			},
		},
	},
	test: {
		include: ['src/**/*.test.{ts,tsx}'],
	},
})
