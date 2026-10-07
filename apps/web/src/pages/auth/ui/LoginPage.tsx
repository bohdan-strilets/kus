import { useTranslation } from 'react-i18next'

import { LoginForm, useLoginForm } from '@/features/authenticate'
import { Hamster, Text, Wordmark } from '@/shared/ui'

import { AuthLayout } from './AuthLayout'

const HAMSTER_SIZE = 110
const WORDMARK_SIZE = 34

/** /login — auth-login, and auth-login-error while a message is on screen (hamster `oops`). */
export const LoginPage = () => {
	const { t } = useTranslation()
	const state = useLoginForm()

	return (
		<AuthLayout
			header={
				<div className="flex flex-col items-center gap-2.5">
					<Hamster mood={state.hasError ? 'oops' : 'wave'} size={HAMSTER_SIZE} />
					<Wordmark size={WORDMARK_SIZE} />
				</div>
			}
		>
			<LoginForm state={state} />
			<Text variant="small" tone="muted" weight="regular" className="max-w-70 text-center">
				{t('auth.privacyNote')}
			</Text>
		</AuthLayout>
	)
}
