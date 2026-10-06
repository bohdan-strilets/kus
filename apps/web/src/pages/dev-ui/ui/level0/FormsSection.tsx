import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
	Button,
	CameraIcon,
	FormField,
	IconButton,
	Input,
	SendIcon,
	Surface,
	Textarea,
} from '@/shared/ui'

import { DemoButton } from '../DemoButton'
import { DevSection } from '../DevSection'

const EYE_ICON_SIZE = 20

export const FormsSection = () => {
	const { t } = useTranslation()
	const [isPasswordShown, setIsPasswordShown] = useState(false)
	const [hasError, setHasError] = useState(false)
	// stands in for React Hook Form's formState.submitCount
	const [attemptCount, setAttemptCount] = useState(0)
	const [message, setMessage] = useState('')

	return (
		<DevSection title={t('devUi.sections.forms')}>
			<form
				className="flex flex-col gap-2.5"
				onSubmit={(event) => {
					event.preventDefault()
					// every submit fails in the demo: the same message, a new shake
					setAttemptCount((count) => count + 1)
					setHasError(true)
				}}
			>
				<FormField label={t('devUi.level0.email')}>
					{(controlProps) => (
						<Input
							type="email"
							autoComplete="username"
							defaultValue={t('devUi.level0.emailValue')}
							{...controlProps}
						/>
					)}
				</FormField>
				<FormField
					label={t('devUi.level0.password')}
					error={hasError ? t('devUi.level0.passwordError') : undefined}
					attemptCount={attemptCount}
					endSlot={
						<IconButton
							variant="ghost"
							label={
								isPasswordShown ? t('devUi.level0.hidePassword') : t('devUi.level0.showPassword')
							}
							onClick={() => {
								setIsPasswordShown((value) => !value)
							}}
						>
							{isPasswordShown ? (
								<EyeSlashIcon aria-hidden size={EYE_ICON_SIZE} />
							) : (
								<EyeIcon aria-hidden size={EYE_ICON_SIZE} />
							)}
						</IconButton>
					}
				>
					{(controlProps) => (
						<Input
							type={isPasswordShown ? 'text' : 'password'}
							defaultValue="password12"
							autoComplete="current-password"
							{...controlProps}
						/>
					)}
				</FormField>
				<FormField label={t('devUi.level0.note')}>
					{(controlProps) => <Textarea variant="field" {...controlProps} />}
				</FormField>
				<Button variant="textOnBackground" size="sm" className="self-end">
					{t('devUi.level0.forgot')}
				</Button>
				<Button type="submit" isFullWidth>
					{t('devUi.level0.login')}
				</Button>
				<div>
					<DemoButton
						label={t('devUi.level0.toggleError')}
						onClick={() => {
							setHasError(false)
						}}
					/>
				</div>
			</form>

			<Surface radius="panel" shadow="float" className="flex items-end gap-2 p-1.5">
				<IconButton size="sm" label={t('devUi.level0.addPhoto')}>
					<CameraIcon />
				</IconButton>
				<Textarea
					aria-label={t('devUi.level0.composerPlaceholder')}
					placeholder={t('devUi.level0.composerPlaceholder')}
					value={message}
					onChange={(event) => {
						setMessage(event.target.value)
					}}
					className="self-center"
				/>
				<IconButton variant="primary" label={t('devUi.level0.send')}>
					<SendIcon />
				</IconButton>
			</Surface>
		</DevSection>
	)
}
