import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
		// read @kus/shared from its TS sources, so web needs no shared rebuild in dev
		conditions: ['source'],
	},
	server: {
		port: 5173,
		strictPort: true,
	},
	test: {
		include: ['src/**/*.test.{ts,tsx}'],
	},
})
