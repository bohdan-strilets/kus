import { useTranslation } from 'react-i18next'

import { FormField, Input, type InputProps } from '@/shared/ui'

interface EmailFieldProps {
	error?: string
	attemptCount: number
	inputProps: Omit<InputProps, 'type' | 'autoComplete' | 'inputMode' | 'id'>
}

export const EmailField = ({ error, attemptCount, inputProps }: EmailFieldProps) => {
	const { t } = useTranslation()

	return (
		<FormField label={t('auth.email')} error={error} attemptCount={attemptCount}>
			{(controlProps) => (
				<Input
					type="email"
					inputMode="email"
					autoComplete="email"
					autoCapitalize="none"
					spellCheck={false}
					{...inputProps}
					{...controlProps}
				/>
			)}
		</FormField>
	)
}
