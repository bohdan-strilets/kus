import { useTranslation } from 'react-i18next'

import { BaseBottomSheet, Button, Heading, Icon, Text } from '@/shared/ui'

import { MEASURE_INFO_SECTIONS } from './measure-info.constants'

interface MeasureInfoSheetProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
}

/** Why Kusik asks for weight and waist, and how to measure them. */
export const MeasureInfoSheet = ({ isOpen, onOpenChange }: MeasureInfoSheetProps) => {
	const { t } = useTranslation()

	return (
		<BaseBottomSheet isOpen={isOpen} onOpenChange={onOpenChange} title={t('measureInfo.title')}>
			{MEASURE_INFO_SECTIONS.map((section) => (
				<section key={section.titleKey} className="flex items-start gap-3">
					<span className="flex size-9 shrink-0 items-center justify-center rounded-icon bg-primary-soft text-primary">
						<Icon name={section.iconName} size={18} />
					</span>
					<div className="flex min-w-0 flex-col gap-1">
						<Heading level="title" as="h3" className="text-body font-bold">
							{t(section.titleKey)}
						</Heading>
						<ul className="flex list-disc flex-col gap-1.5 pl-5">
							{section.itemKeys.map((itemKey) => (
								<li key={itemKey}>
									<Text variant="body" weight="regular" tone="mutedStrong" as="span">
										{t(itemKey)}
									</Text>
								</li>
							))}
						</ul>
					</div>
				</section>
			))}
			<Button
				isFullWidth
				onClick={() => {
					onOpenChange(false)
				}}
			>
				{t('measureInfo.ok')}
			</Button>
		</BaseBottomSheet>
	)
}
