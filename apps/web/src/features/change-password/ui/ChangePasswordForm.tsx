import { PASSWORD_MIN_LENGTH } from '@kus/shared'
import { Controller } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'
import { Button, FormAlert, Icon, PasswordField } from '@/shared/ui'

import { useChangePasswordForm } from '../model/use-change-password-form'

const HINT_ICON_SIZE = 14

/** mockups/change-password.html: three password fields, the length hint, «Зберегти пароль». */
export const ChangePasswordForm = () => {
	const { t } = useTranslation()
	const { form, onSubmit, isSubmitting, formMessage } = useChangePasswordForm()
	const { submitCount } = form.formState
	const isNewLongEnough = form.watch('newPassword').length >= PASSWORD_MIN_LENGTH

	return (
		<form
			noValidate
			onSubmit={(event) => {
				void onSubmit(event)
			}}
			className="flex flex-col gap-2.5"
		>
			<Controller
				control={form.control}
				name="currentPassword"
				render={({ field, fieldState }) => (
					<PasswordField
						label={t('changePassword.current')}
						error={fieldState.error?.message}
						attemptCount={submitCount}
						autoComplete="current-password"
						inputProps={field}
					/>
				)}
			/>
			{/* the mockup's 6px spacer: the current password is set apart from the new pair */}
			<div aria-hidden="true" className="h-1.5" />
			<Controller
				control={form.control}
				name="newPassword"
				render={({ field, fieldState }) => (
					<PasswordField
						label={t('changePassword.new')}
						error={fieldState.error?.message}
						attemptCount={submitCount}
						autoComplete="new-password"
						inputProps={field}
					/>
				)}
			/>
			<Controller
				control={form.control}
				name="repeatPassword"
				render={({ field, fieldState }) => (
					<PasswordField
						label={t('changePassword.repeat')}
						error={fieldState.error?.message}
						attemptCount={submitCount}
						autoComplete="new-password"
						inputProps={field}
					/>
				)}
			/>
			<p
				className={cn(
					'flex items-center gap-1.5 text-small font-semibold',
					isNewLongEnough ? 'text-success-ink' : 'text-muted',
				)}
			>
				<Icon
					name="check"
					size={HINT_ICON_SIZE}
					className={isNewLongEnough ? 'text-success' : undefined}
				/>
				{t('changePassword.hint', { min: PASSWORD_MIN_LENGTH })}
			</p>
			<FormAlert message={formMessage} />
			<Button
				type="submit"
				isFullWidth
				isLoading={isSubmitting}
				loadingText={t('changePassword.saving')}
				className="mt-2"
			>
				{t('changePassword.save')}
			</Button>
		</form>
	)
}
