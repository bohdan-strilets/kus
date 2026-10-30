import { useTranslation } from 'react-i18next'

import { Button, Icon, ICON_SIZE, Text } from '@/shared/ui'

import { getRememberedLabel } from '../lib/get-remembered-label'
import type { RememberActionState } from '../model/use-remember-action'
import { RememberSheet } from './RememberSheet'

interface RememberActionProps {
	action: RememberActionState
}

/**
 * «Запам'ятати» in a meal card's footer (mockups/chat-remember-product.html): the button while a
 * line can be remembered, «✓ Запам'ятав: …» after it. Several new lines go through the sheet.
 */
export const RememberAction = ({ action }: RememberActionProps) => {
	const { t } = useTranslation()
	const { rememberable, rememberedNames, isSheetOpen, isPending } = action
	const hasStatus = rememberedNames.length > 0

	// the live region exists before the text does, so a screen reader announces the result; empty, it
	// is sr-only and takes no line. The status is its own line above the buttons (the row wraps)
	return (
		<>
			<Text
				as="span"
				role="status"
				variant="caption"
				weight="bold"
				tone="successInk"
				className={
					hasStatus ? 'order-first flex basis-full items-center gap-1.5 self-start' : 'sr-only'
				}
			>
				{hasStatus && (
					<>
						<Icon name="check" size={ICON_SIZE.small} />
						{getRememberedLabel(rememberedNames, t)}
					</>
				)}
			</Text>
			{rememberable.length > 0 && (
				<Button
					variant="soft"
					size="sm"
					isLoading={isPending && !isSheetOpen}
					loadingText={t('remember.saving')}
					icon={<Icon name="memory" size={ICON_SIZE.small} />}
					onClick={action.press}
				>
					{t('remember.action')}
				</Button>
			)}
			{rememberable.length > 1 && (
				<RememberSheet
					isOpen={isSheetOpen}
					onOpenChange={action.setIsSheetOpen}
					entries={rememberable}
					isPending={isPending}
					onSubmit={(entryIds) => {
						void action.submit(entryIds)
					}}
				/>
			)}
		</>
	)
}
