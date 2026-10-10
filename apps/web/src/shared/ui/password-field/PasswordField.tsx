import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FormField } from '../form-field'
import { Icon, ICON_SIZE } from '../icon'
import { IconButton } from '../icon-button'
import { Input, type InputProps } from '../input'

export interface PasswordFieldProps {
	label: string
	error?: string
	hint?: string
	attemptCount: number
	/** current-password on login, new-password on registration (password managers rely on it). */
	autoComplete: 'current-password' | 'new-password'
	inputProps: Omit<InputProps, 'type' | 'autoComplete' | 'id'>
}

/** docs Field → «Пароль — кнопка "показати" 44×44 праворуч». */
export const PasswordField = ({
	label,
	error,
	hint,
	attemptCount,
	autoComplete,
	inputProps,
}: PasswordFieldProps) => {
	const { t } = useTranslation()
	const [isShown, setIsShown] = useState(false)

	return (
		<FormField
			label={label}
			error={error}
			hint={hint}
			attemptCount={attemptCount}
			endSlot={
				<IconButton
					variant="ghost"
					label={isShown ? t('common.hidePassword') : t('common.showPassword')}
					aria-pressed={isShown}
					onClick={() => {
						setIsShown((value) => !value)
					}}
				>
					<Icon name={isShown ? 'eye-off' : 'eye'} size={ICON_SIZE.control} />
				</IconButton>
			}
		>
			{(controlProps) => (
				<Input
					type={isShown ? 'text' : 'password'}
					autoComplete={autoComplete}
					autoCapitalize="none"
					spellCheck={false}
					{...inputProps}
					{...controlProps}
				/>
			)}
		</FormField>
	)
}
