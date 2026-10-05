import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	// esbuild can't emit decorator metadata, which Nest DI relies on — SWC can
	plugins: [swc.vite({ module: { type: 'es6' } })],
	test: {
		include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
		env: {
			NODE_ENV: 'test',
			DATABASE_URL: 'postgresql://test:test@localhost:5432/kus_test',
			PORT: '3000',
			CORS_ORIGIN: 'http://localhost:5173',
			OPENROUTER_API_KEY: 'test-key',
			AI_MODEL: 'test/model',
		},
	},
})
