import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	// esbuild can't emit decorator metadata, which Nest DI relies on — SWC can
	plugins: [swc.vite({ module: { type: 'es6' } })],
	test: {
		include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
		// creates kus_test in the local docker DB (`pnpm db:up`) and applies migrations
		globalSetup: ['test/db-global-setup.ts'],
		// DB-backed e2e files share kus_test and TRUNCATE it before each test, so files run one by one
		fileParallelism: false,
		env: {
			NODE_ENV: 'test',
			// same server as local dev (docker-compose.yml) and the CI service; separate *_test database
			DATABASE_URL: 'postgresql://kus:kus@localhost:5434/kus_test',
			PORT: '3000',
			CORS_ORIGIN: 'http://localhost:5173',
			OPENROUTER_API_KEY: 'test-key',
			AI_MODEL: 'test/model',
			JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters',
			ALLOW_REGISTRATION: 'true',
		},
	},
})
