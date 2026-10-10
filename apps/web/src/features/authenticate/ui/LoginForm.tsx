import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button, FormAlert, PasswordField } from '@/shared/ui'

import type { LoginFormState } from '../model/use-login-form'
import { EmailField } from './EmailField'

/** auth-login / auth-login-error. The state comes from useLoginForm, owned by the page. */
export const LoginForm = ({ state }: { state: LoginFormState }) => {
	const { t } = useTranslation()
	const { form, onSubmit, isSubmitting, formMessage } = state
	const { submitCount } = form.formState

	return (
		<form
			noValidate
			onSubmit={(event) => {
				void onSubmit(event)
			}}
			className="flex flex-col gap-2.5 self-stretch"
		>
			<Controller
				control={form.control}
				name="email"
				render={({ field, fieldState }) => (
					<EmailField
						error={fieldState.error?.message}
						attemptCount={submitCount}
						inputProps={field}
					/>
				)}
			/>
			<Controller
				control={form.control}
				name="password"
				render={({ field, fieldState }) => (
					<PasswordField
						label={t('auth.password')}
						error={fieldState.error?.message}
						attemptCount={submitCount}
						autoComplete="current-password"
						inputProps={field}
					/>
				)}
			/>
			<FormAlert message={formMessage} />
			<Button type="submit" isFullWidth isLoading={isSubmitting} loadingText={t('auth.loggingIn')}>
				{t('auth.login')}
			</Button>
		</form>
	)
}
