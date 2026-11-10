import { AI_ERROR_DETAIL_MAX_LENGTH } from './ai.constants'

const QUOTED = /"[^"]*"/g
/** A number that is not a path index (`items.0`) and not part of a ref (`e7`); `72kg` counts too. */
const NUMBER = /(?<![.\w])\d+(?:\.\d+)?(?!\d)/g
const HINT_SEPARATOR = ' — '

/**
 * Validation errors of a rejected answer as a short technical line for AiRun.errorDetail. Some
 * errors quote what the model got from the user (a food name, a weight), so quoted text and
 * numbers are masked, and the hint after « — » (advice for the model) is cut.
 */
export const toValidationErrorDetail = (errors: readonly string[]): string =>
	errors
		.map((error) => {
			const [head = ''] = error.split(HINT_SEPARATOR)
			return head.replace(QUOTED, '"…"').replace(NUMBER, '#')
		})
		.join('; ')
		.slice(0, AI_ERROR_DETAIL_MAX_LENGTH)
