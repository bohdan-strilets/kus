import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'
import { Icon, Text } from '@/shared/ui'

import type { FormattedSets, SetSegment } from '../../lib/format-sets'

const RECORD_ICON_SIZE = 13

export interface SetLineProps {
	sets: FormattedSets
	className?: string
}

const Multiplier = ({ value }: { value: number }) => (
	<Text as="span" variant="caption" tone="muted" weight="semibold" isTabular>
		{' ×'}
		{value}
	</Text>
)

const Segment = ({ segment }: { segment: SetSegment }) => {
	const { t } = useTranslation()
	if (segment.kind === 'warmup') {
		return (
			<span className="rounded-checkbox border border-dashed border-line-strong px-1.5 py-px whitespace-nowrap">
				<Text as="span" variant="small" tone="muted" weight="semibold" isTabular>
					{t('workout.warmupShort')} {segment.text}
				</Text>
				{segment.multiplier !== undefined && <Multiplier value={segment.multiplier} />}
			</span>
		)
	}
	if (segment.kind === 'record') {
		return (
			<span className="inline-flex items-center gap-1 whitespace-nowrap text-success-ink">
				<Text as="span" variant="caption" tone="successInk" weight="extrabold" isTabular>
					{segment.text}
				</Text>
				<Icon name="trophy" size={RECORD_ICON_SIZE} />
				<span className="sr-only">{t('workout.record')}</span>
			</span>
		)
	}
	return (
		<span className="whitespace-nowrap">
			<Text as="span" variant="caption" weight="bold" isTabular>
				{segment.text}
			</Text>
			{segment.multiplier !== undefined && <Multiplier value={segment.multiplier} />}
		</span>
	)
}

/**
 * The sets of an exercise in the notation «60×8 ×3 · 65×6» (design/docs/training-groups.md): wraps
 * between sets, a warm-up is a dashed plate, a record is success-ink with a trophy and a text for
 * screen readers.
 */
export const SetLine = ({ sets, className }: SetLineProps) => {
	const { segments, unit } = sets
	if (segments.length === 0) return null
	const lastIndex = segments.length - 1
	return (
		<p className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-strong', className)}>
			{segments.map((segment, index) => {
				const previous = segments[index - 1]
				const needsDot =
					previous !== undefined && previous.kind !== 'warmup' && segment.kind !== 'warmup'
				return (
					<Fragment key={`${segment.kind}-${segment.text}-${index}`}>
						{needsDot && (
							<span aria-hidden="true" className="text-muted-soft">
								·
							</span>
						)}
						<Segment segment={segment} />
						{index === lastIndex && unit !== null && (
							<Text as="span" variant="caption" weight="bold" tone="mutedStrong">
								{unit}
							</Text>
						)}
					</Fragment>
				)
			})}
		</p>
	)
}
