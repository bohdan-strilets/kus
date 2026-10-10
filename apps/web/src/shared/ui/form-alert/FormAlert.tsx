import { useTranslation } from 'react-i18next'

import { type ApiMessage, translateApiMessage } from '@/shared/api'

import { Text } from '../text'

export interface FormAlertProps {
	message: ApiMessage | null
}

/**
 * The alert line above the submit button for errors that aren't about one field (lockout, 429,
 * registration closed, network, 5xx). Deliberately not a toast: it stays until the next attempt
 * (docs/design-tokens.md, «Відступи від макетів»).
 */
export const FormAlert = ({ message }: FormAlertProps) => {
	const { t } = useTranslation()
	if (!message) return null

	return (
		<Text role="alert" variant="small" tone="danger">
			{translateApiMessage(t, message)}
		</Text>
	)
}
