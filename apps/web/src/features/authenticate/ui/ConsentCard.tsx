import * as Checkbox from '@radix-ui/react-checkbox'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { Icon, Text } from '@/shared/ui'

import { checkboxVariants } from './consent-card.variants'

const CHECK_ICON_SIZE = 16

interface ConsentCardProps {
	isChecked: boolean
	onCheckedChange: (isChecked: boolean) => void
	onBlur: () => void
	error?: string
}

/**
 * docs Consent card: its own card with a 22px checkbox and two lines of text. The whole card is
 * the label, so the tap target is the card, not the 22px box.
 */
export const ConsentCard = ({ isChecked, onCheckedChange, onBlur, error }: ConsentCardProps) => {
	const { t } = useTranslation()
	const id = useId()
	const titleId = `${id}-title`
	const textId = `${id}-text`
	const errorId = `${id}-error`

	return (
		<div className="mt-1 flex flex-col gap-1.5">
			<label
				htmlFor={id}
				className="flex cursor-pointer items-start gap-3.25 rounded-tile bg-surface/60 p-3.5"
			>
				<Checkbox.Root
					id={id}
					checked={isChecked}
					onCheckedChange={(state) => {
						onCheckedChange(state === true)
					}}
					onBlur={onBlur}
					// the label wraps both lines; name = title only, so the text isn't read twice
					aria-labelledby={titleId}
					aria-describedby={error ? `${textId} ${errorId}` : textId}
					aria-invalid={Boolean(error)}
					className={checkboxVariants({ isChecked })}
				>
					<Checkbox.Indicator>
						<Icon name="check" size={CHECK_ICON_SIZE} />
					</Checkbox.Indicator>
				</Checkbox.Root>
				<span className="flex flex-col gap-1.5">
					<Text as="span" id={titleId} variant="cardTitle">
						{t('auth.consentTitle')}
					</Text>
					<Text as="span" id={textId} variant="caption" tone="mutedStrong" weight="regular">
						{t('auth.consentText')}
					</Text>
				</span>
			</label>
			{error && (
				<Text id={errorId} role="alert" variant="small" tone="danger">
					{error}
				</Text>
			)}
		</div>
	)
}
