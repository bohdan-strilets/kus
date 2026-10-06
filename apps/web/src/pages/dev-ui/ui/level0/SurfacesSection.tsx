import { useTranslation } from 'react-i18next'

import { formatInteger } from '@/shared/lib'
import { Heading, Surface, type SurfaceProps, Text } from '@/shared/ui'

import { DevSection } from '../DevSection'

// variant names are code identifiers, shown as-is like the colour catalogue
const SURFACES: readonly NonNullable<SurfaceProps['variant']>[] = [
	'solid',
	'glass',
	'frosted',
	'dashed',
	'soft',
	'field',
	'selected',
]
const SEED_EATEN_KCAL = 1370

export const SurfacesSection = () => {
	const { t } = useTranslation()

	return (
		<DevSection title={t('devUi.sections.surfaces')}>
			<div className="grid grid-cols-2 gap-3">
				{SURFACES.map((variant) => (
					<Surface
						key={variant}
						variant={variant}
						radius="tile"
						shadow={variant === 'dashed' ? 'none' : 'chip'}
						className="flex h-16 items-center justify-center"
					>
						<Text variant="small" tone="muted">
							{variant}
						</Text>
					</Surface>
				))}
			</div>
			<Surface className="flex flex-col gap-2 p-4">
				<Text variant="eyebrow" tone="muted">
					{t('devUi.level0.eyebrow')}
				</Text>
				<Heading as="h3">{t('devUi.level0.screenTitle')}</Heading>
				<Heading as="h3" level="title">
					{t('devUi.level0.title')}
				</Heading>
				<Text variant="bigNumber">{formatInteger(SEED_EATEN_KCAL)}</Text>
				<Text>{t('devUi.level0.body')}</Text>
				<Text variant="caption" tone="muted">
					{t('devUi.level0.caption')}
				</Text>
				<Text variant="small" tone="overInk">
					{t('devUi.level0.overGoal')}
				</Text>
				<Text variant="small" tone="success">
					{t('devUi.level0.goalClosed')}
				</Text>
			</Surface>
		</DevSection>
	)
}
