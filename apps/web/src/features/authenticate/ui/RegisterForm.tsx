import { PASSWORD_MIN_LENGTH } from '@kus/shared'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Button, FormAlert, FormField, Input, PasswordField } from '@/shared/ui'

import type { RegisterFormState } from '../model/use-register-form'
import { ConsentCard } from './ConsentCard'
import { EmailField } from './EmailField'

/** auth-register. Without consent the button is disabled (docs Consent card). */
export const RegisterForm = ({ state }: { state: RegisterFormState }) => {
	const { t } = useTranslation()
	const { form, onSubmit, isSubmitting, formMessage, hasConsent } = state
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
				name="name"
				render={({ field, fieldState }) => (
					<FormField
						label={t('auth.name')}
						error={fieldState.error?.message}
						attemptCount={submitCount}
					>
						{(controlProps) => (
							<Input type="text" autoComplete="given-name" {...field} {...controlProps} />
						)}
					</FormField>
				)}
			/>
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
						hint={t('auth.passwordHint', { min: PASSWORD_MIN_LENGTH })}
						attemptCount={submitCount}
						autoComplete="new-password"
						inputProps={field}
					/>
				)}
			/>
			<Controller
				control={form.control}
				name="consent"
				render={({ field, fieldState }) => (
					<ConsentCard
						isChecked={field.value}
						onCheckedChange={field.onChange}
						onBlur={field.onBlur}
						error={fieldState.error?.message}
					/>
				)}
			/>
			<FormAlert message={formMessage} />
			<Button
				type="submit"
				isFullWidth
				disabled={!hasConsent}
				isLoading={isSubmitting}
				loadingText={t('auth.registering')}
			>
				{t('auth.register')}
			</Button>
		</form>
	)
}
