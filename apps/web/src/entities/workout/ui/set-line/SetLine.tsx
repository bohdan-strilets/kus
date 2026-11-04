import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'
import { Icon, Text } from '@/shared/ui'

import type { FormattedSets, SetSegment } from '../../lib/format-sets'

const RECORD_ICON_SIZE = 13

export interface SetLineProps {
	sets: FormattedSets
	className?: string
}

const Pill = ({ segment }: { segment: SetSegment }) => {
	const { t } = useTranslation()
	if (segment.kind === 'warmup') {
		return (
			<span className="rounded-tag border-2 border-dashed border-line-strong px-2 py-0.5 whitespace-nowrap">
				<Text as="span" variant="caption" tone="muted" isTabular>
					{t('workout.warmupSet', { value: segment.text })}
				</Text>
			</span>
		)
	}
	if (segment.kind === 'record') {
		return (
			<span className="inline-flex items-center gap-0.75 rounded-tag bg-success-soft px-2 py-0.75 whitespace-nowrap">
				<Text as="span" variant="cardTitle" tone="successInk" weight="extrabold" isTabular>
					{segment.text}
				</Text>
				<Icon name="trophy" size={RECORD_ICON_SIZE} className="text-success-ink" />
				<span className="sr-only">{t('workout.record')}</span>
			</span>
		)
	}
	return (
		<span className="rounded-tag bg-field px-2 py-0.75 whitespace-nowrap">
			<Text as="span" variant="cardTitle" isTabular>
				{segment.text}
			</Text>
		</span>
	)
}

const Segment = ({ segment }: { segment: SetSegment }) => {
	const { t } = useTranslation()
	if (segment.count === undefined) return <Pill segment={segment} />
	return (
		<span className="inline-flex items-center gap-1.5 whitespace-nowrap">
			<Pill segment={segment} />
			<Text as="span" variant="caption" tone="mutedStrong" weight="regular">
				{t('workout.setRepeat', { value: t('workout.setCountFull', { count: segment.count }) })}
			</Text>
		</span>
	)
}

/**
 * The sets of an exercise as pills «60 кг × 8 — 3 підходи» (design/docs/training-groups.md): they
 * wrap between sets, a warm-up is a dashed pill, a record is `success-soft` with a trophy and a
 * text for screen readers.
 */
export const SetLine = ({ sets, className }: SetLineProps) => {
	const { segments } = sets
	if (segments.length === 0) return null
	return (
		<p className={cn('flex flex-wrap items-center gap-1.25', className)}>
			{segments.map((segment, index) => (
				<Segment key={`${segment.kind}-${segment.text}-${index}`} segment={segment} />
			))}
		</p>
	)
}
