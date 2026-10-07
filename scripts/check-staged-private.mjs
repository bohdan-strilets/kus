// Pre-commit guard: refuses a commit that stages private eval data or eval results.
// CLAUDE.md §9 — no real meals, weight or photos in git; .gitignore alone once missed a nested path.
import { execFileSync } from 'node:child_process'

/**
 * Any path segment, so nested folders (packages/ai-eval/data/private/…) are caught too. Case-
 * insensitive: on Windows / macOS "Data/Private" is the same folder. A rename out of such a
 * folder (data/private/x.json → src/x.json) can't be told by the path — only its content shows it.
 */
const FORBIDDEN_PATTERNS = [/(^|\/)data\/private\//i, /(^|\/)results\//i]

// added, copied, modified, renamed — removing such a file from the repo must stay possible
const stagedPaths = execFileSync(
	'git',
	['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'],
	{ encoding: 'utf8' },
)
	.split('\0')
	.filter(Boolean)

const forbidden = stagedPaths.filter((path) =>
	FORBIDDEN_PATTERNS.some((pattern) => pattern.test(path)),
)

if (forbidden.length > 0) {
	process.stderr.write(
		`Commit blocked: private data or eval results are staged:\n${forbidden.map((path) => `  ${path}`).join('\n')}\nUnstage them: git restore --staged <path>\n`,
	)
	process.exit(1)
}
