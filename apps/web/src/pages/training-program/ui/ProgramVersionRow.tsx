import { useTranslation } from 'react-i18next'

import { formatProgramVersionDate } from '@/entities/program'
import { cn } from '@/shared/lib'
import { Icon, ICON_SIZE, Surface, Text } from '@/shared/ui'

interface ProgramVersionRowProps {
	createdAt: string
	onOpen: () => void
}

/** «Версія від 31.10 · що змінилось ›»: opens the sheet with the history of versions. */
export const ProgramVersionRow = ({ createdAt, onOpen }: ProgramVersionRowProps) => {
	const { t } = useTranslation()
	return (
		<Surface variant="translucent" radius="bubbleAi" shadow="none">
			<button
				type="button"
				onClick={onOpen}
				className={cn(
					'flex min-h-tap w-full cursor-pointer items-center gap-2 rounded-bubble-ai px-3.5 text-left',
					'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink',
				)}
			>
				<Icon name="clock" size={ICON_SIZE.small} className="flex-none text-muted-strong" />
				<Text as="span" variant="caption" tone="mutedStrong" weight="regular" className="flex-1">
					{formatProgramVersionDate(createdAt, t)}
					{' · '}
					<Text as="span" variant="caption" tone="primaryDeep" weight="bold">
						{t('program.screen.whatChanged')}
					</Text>
				</Text>
				<Icon name="chevron-right" size={ICON_SIZE.control} className="flex-none text-muted" />
			</button>
		</Surface>
	)
}
