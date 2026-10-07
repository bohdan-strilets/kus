import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Feature-Sliced Design layers, top to bottom (CLAUDE.md §4). A layer may import only from layers below it.
const FSD_LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']

const FSD_COMMON_PATTERNS = [
	{
		regex: '^@/((pages|widgets|features|entities)/[^/]+|shared/[^/]+)/.+',
		message:
			'Import a slice or shared segment through its public API (index.ts), not its internals.',
	},
	{
		regex: '^(\\.\\./)+(app|pages|widgets|features|entities|shared)(/|$)',
		message: 'Use the @/ alias for imports across layers.',
	},
]

const createFsdBoundaries = (layer, index) => {
	const upperLayers = FSD_LAYERS.slice(0, index)
	const patterns = [...FSD_COMMON_PATTERNS]
	if (upperLayers.length > 0) {
		patterns.push({
			regex: `^@/(${upperLayers.join('|')})(/|$)`,
			message: `FSD: "${layer}" must not import from upper layers (${upperLayers.join(', ')}).`,
		})
	}
	if (layer === 'features') {
		patterns.push({
			regex: '^@/features(/|$)',
			message: 'No cross-feature imports (CLAUDE.md §4): move shared logic to entities or shared.',
		})
	}
	return {
		files: [`apps/web/src/${layer}/**/*.{ts,tsx}`],
		rules: { 'no-restricted-imports': ['error', { patterns }] },
	}
}

export default tseslint.config(
	{ ignores: ['design/**'] },
	{
		ignores: [
			'**/dist/**',
			'**/coverage/**',
			'**/node_modules/**',
			'apps/api/src/generated/**',
			// icon packs built by apps/web/scripts/build-icons.mjs
			'**/*.generated.tsx',
			'**/*.preview.html',
		],
	},
	js.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// CLAUDE.md §7: arrow functions only
			'func-style': ['error', 'expression'],
			'prefer-arrow-callback': 'error',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/consistent-type-imports': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
			'@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
			'no-console': 'error',
			'no-restricted-syntax': [
				'error',
				{
					selector: "CallExpression[callee.name='forwardRef']",
					message: 'React 19 passes ref as a prop — forwardRef is not needed.',
				},
			],
		},
	},
	{
		files: ['**/*.{js,mjs,cjs}'],
		extends: [tseslint.configs.disableTypeChecked],
		languageOptions: { globals: globals.node },
	},
	{
		// CLI scripts report to the terminal
		files: ['apps/web/scripts/**/*.mjs'],
		rules: { 'no-console': 'off' },
	},
	{
		files: ['apps/api/**/*.ts'],
		languageOptions: { globals: globals.node },
		rules: {
			// Nest DI needs runtime class references in constructors, not type-only imports
			'@typescript-eslint/consistent-type-imports': 'off',
			// Nest modules and DTOs are decorated empty classes by design
			'@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
		},
	},
	{
		files: ['apps/web/**/*.{ts,tsx}'],
		languageOptions: { globals: globals.browser },
		plugins: {
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
		},
	},
	...FSD_LAYERS.map(createFsdBoundaries),
	prettier,
)
