import { defineConfig } from 'vitest/config'

// Real-bucket smoke tests only: no DB global setup and no fake env from the default config.
// The switch lives here (not in the script) so the command is identical in PowerShell and Git Bash.
export default defineConfig({
	test: {
		include: ['src/**/*.smoke.spec.ts'],
		env: { STORAGE_SMOKE: '1' },
		testTimeout: 60_000,
		hookTimeout: 60_000,
	},
})
