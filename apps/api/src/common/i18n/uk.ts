/**
 * Kusik's own words the backend writes into the chat without the model: warm and short
 * (CLAUDE.md §6), the user addressed without a gendered verb form. `{{name}}` as in the web locales.
 */
export const UK_TEXTS = {
	welcomeBack: {
		withName: 'З поверненням, {{name}}! Усе на місці, як і було. Пиши, що їси — я порахую.',
		withoutName: 'З поверненням! Усе на місці, як і було. Пиши, що їси — я порахую.',
	},
}

export type Texts = typeof UK_TEXTS
