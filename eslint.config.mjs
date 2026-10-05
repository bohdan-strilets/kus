import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
	{
		ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**', 'apps/api/src/generated/**'],
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
	prettier,
)
