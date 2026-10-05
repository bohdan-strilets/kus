// Typecheck runs per package (whole project), so the staged file list is not passed to tsc.
const typecheck = (pkg) => () => `pnpm --filter ${pkg} typecheck`

export default {
	'*.{ts,tsx,js,mjs,cjs}': ['eslint --fix --max-warnings=0', 'prettier --write'],
	'*.{json,md,css,yml,yaml}': 'prettier --write',
	'packages/shared/**/*.ts': typecheck('@kus/shared'),
	// api type-checks against the built shared package, so rebuild it first
	'apps/api/**/*.ts': () => ['pnpm --filter @kus/shared build', 'pnpm --filter @kus/api typecheck'],
	'apps/web/**/*.{ts,tsx}': typecheck('@kus/web'),
}
