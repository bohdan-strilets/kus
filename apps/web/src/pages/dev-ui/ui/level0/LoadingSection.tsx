import { useTranslation } from 'react-i18next'

import { MeterBar, ProgressBar, Skeleton, Surface, Text } from '@/shared/ui'

import { useReplay } from '../../model/use-replay'
import { DemoButton } from '../DemoButton'
import { DevSection } from '../DevSection'

// Seed data from design/docs/screens.md: Б 78/140 · В 160/225 · Ж 48/80
const MACROS = [
	{ labelKey: 'devUi.level0.protein', tone: 'protein', value: 78, max: 140 },
	{ labelKey: 'devUi.level0.carbs', tone: 'carbs', value: 160, max: 225 },
	{ labelKey: 'devUi.level0.fat', tone: 'fat', value: 48, max: 80 },
] as const

const METER_PERCENTS = [0, 3, 50, 100] as const

export const LoadingSection = () => {
	const { t } = useTranslation()
	const [barsKey, replayBars] = useReplay()

	return (
		<DevSection title={t('devUi.sections.loading')}>
			<Surface
				role="status"
				aria-label={t('devUi.level0.loadingDay')}
				className="flex items-center gap-3 p-4"
			>
				<Skeleton shape="circle" className="size-11" />
				<div className="flex flex-1 flex-col gap-2">
					<Skeleton className="w-2/3" />
					<Skeleton className="w-1/3" />
				</div>
				<Skeleton shape="block" className="h-6 w-12" />
			</Surface>

			<Surface key={barsKey} className="flex flex-col gap-3 p-4">
				{MACROS.map((macro, index) => (
					<div key={macro.labelKey} className="flex flex-col gap-1.5">
						<Text variant="small" tone="muted">
							{t(macro.labelKey)}
						</Text>
						<ProgressBar
							label={t(macro.labelKey)}
							tone={macro.tone}
							value={macro.value}
							max={macro.max}
							index={index}
						/>
					</div>
				))}
			</Surface>
			<Surface className="flex flex-col gap-3 p-4">
				{METER_PERCENTS.map((percent) => (
					<div key={percent} className="flex items-center gap-2.5">
						<Text as="span" variant="caption" weight="bold" isTabular className="w-10">
							{percent}%
						</Text>
						<MeterBar percent={percent} fillClassName="bg-success" className="flex-1" />
					</div>
				))}
			</Surface>
			<div>
				<DemoButton label={t('devUi.replay')} onClick={replayBars} />
			</div>
		</DevSection>
	)
}
