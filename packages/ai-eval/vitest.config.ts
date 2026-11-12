import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['src/**/*.test.ts'],
		// tests that run a real git commit exceed the default 5 s when the machine is loaded
		testTimeout: 20_000,
	},
})
