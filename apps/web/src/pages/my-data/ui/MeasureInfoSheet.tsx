import { useTranslation } from 'react-i18next'

import { BaseBottomSheet, Button, Heading, Text } from '@/shared/ui'

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
				<section key={section.titleKey} className="flex flex-col gap-1.5">
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
