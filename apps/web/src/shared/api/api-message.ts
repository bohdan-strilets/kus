import type { ParseKeys, TFunction, TOptions } from 'i18next'

/** A translatable message from an API outcome: the i18n key and, when the text needs it, its params. */
export interface ApiMessage {
	key: ParseKeys
	params?: TOptions
}

export const translateApiMessage = (t: TFunction, message: ApiMessage): string =>
	t(message.key, message.params)
