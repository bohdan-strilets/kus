import { useTranslation } from 'react-i18next'

import { Text } from '@/shared/ui'

import { translateAuthError } from '../lib/translate-auth-error'
import type { AuthErrorMessage } from '../model/auth-error.types'

/**
 * The alert line above the submit button for errors that aren't about one field (lockout, 429,
 * registration closed, network, 5xx). Deliberately not a toast: it stays until the next attempt
 * (docs/design-tokens.md, «Відступи від макетів»).
 */
export const FormAlert = ({ message }: { message: AuthErrorMessage | null }) => {
	const { t } = useTranslation()
	if (!message) return null

	return (
		<Text role="alert" variant="small" tone="danger">
			{translateAuthError(t, message)}
		</Text>
	)
}
