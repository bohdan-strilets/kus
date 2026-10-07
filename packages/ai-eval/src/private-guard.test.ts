import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// the real pre-commit guard from the repo root, run by a real git commit in a throwaway repo
const GUARD_SCRIPT = fileURLToPath(
	new URL('../../../scripts/check-staged-private.mjs', import.meta.url),
)

let repo = ''

/** Without GIT_DIR / GIT_INDEX_FILE from a surrounding hook, git would act on the real repo. */
const isolatedEnv = Object.fromEntries(
	Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')),
)

const git = (...args: string[]): void => {
	execFileSync('git', args, { cwd: repo, stdio: 'pipe', env: isolatedEnv })
}

const writeRepoFile = (path: string, content = '{}'): void => {
	mkdirSync(dirname(join(repo, path)), { recursive: true })
	writeFileSync(join(repo, path), content)
}

const runGit = (args: string[]) =>
	spawnSync('git', args, { cwd: repo, encoding: 'utf8', env: isolatedEnv })

const tryCommit = () => runGit(['commit', '-m', 'test'])

const countCommits = (): number => {
	const result = runGit(['rev-list', '--count', 'HEAD'])
	return result.status === 0 ? Number(result.stdout.trim()) : 0
}

describe('pre-commit guard for private data', () => {
	beforeEach(() => {
		repo = mkdtempSync(join(tmpdir(), 'kus-guard-'))
		git('init', '-q')
		git('config', 'user.email', 'test@kus.local')
		git('config', 'user.name', 'Test')
		git('config', 'commit.gpgsign', 'false')
		const hooks = join(repo, '.hooks')
		mkdirSync(hooks)
		const hook = join(hooks, 'pre-commit')
		writeFileSync(hook, `#!/bin/sh\nnode "${GUARD_SCRIPT.replaceAll('\\', '/')}"\n`)
		chmodSync(hook, 0o755)
		git('config', 'core.hooksPath', '.hooks')
	})

	afterEach(() => {
		rmSync(repo, { recursive: true, force: true })
	})

	it('rejects a commit with a nested data/private file, even force-added past .gitignore', () => {
		writeRepoFile('packages/ai-eval/data/private/cases.json')
		git('add', '-f', 'packages/ai-eval/data/private/cases.json')

		const result = tryCommit()

		expect(result.status).not.toBe(0)
		expect(result.stderr).toContain('packages/ai-eval/data/private/cases.json')
		expect(countCommits()).toBe(0)
	})

	it('ignores case, as Windows and macOS do', () => {
		writeRepoFile('Data/Private/cases.json')
		git('add', '-f', 'Data/Private/cases.json')

		expect(tryCommit().status).not.toBe(0)
	})

	it('rejects eval results', () => {
		writeRepoFile('packages/ai-eval/results/run.json')
		git('add', '-f', 'packages/ai-eval/results/run.json')

		expect(tryCommit().status).not.toBe(0)
	})

	it('lets ordinary files through, including names that only look similar', () => {
		writeRepoFile('src/private-cases.ts', 'export {}')
		writeRepoFile('docs/results.md', '# ok')
		git('add', '.')

		expect(tryCommit().status).toBe(0)
		expect(countCommits()).toBe(1)
	})

	it('allows removing a private file that was committed before', () => {
		writeRepoFile('data/private/old.json')
		git('add', '-f', 'data/private/old.json')
		git('commit', '-q', '--no-verify', '-m', 'old mistake')
		git('rm', '-q', '--cached', 'data/private/old.json')

		expect(tryCommit().status).toBe(0)
	})
})
