import { useTranslation } from 'react-i18next'

import { formatInteger } from '@/shared/lib'
import { Text } from '@/shared/ui'

import { formatWorkoutDistance, formatWorkoutMinutes } from '../../lib/format-workout'
import { type SessionTileVariantProps, sessionTileVariants } from './session-tile.variants'

interface TileProps extends SessionTileVariantProps {
	label: string
	value: string
	note?: string | null
}

const Tile = ({ label, value, note = null, tone }: TileProps) => (
	<div className={sessionTileVariants({ tone })}>
		<Text as="span" variant="small" tone={tone === 'cardio' ? 'ink' : 'muted'}>
			{label}
		</Text>
		<Text as="span" variant="stat">
			{value}
		</Text>
		{note !== null && (
			<Text as="span" variant="small" tone="mutedStrong" isTabular>
				{note}
			</Text>
		)}
	</div>
)

export interface SessionTilesProps {
	/** «62 хв» / «≈ 62 хв»; null — no tile. */
	duration: string | null
	/** null: no strength exercise, no tile. */
	strength: { exerciseCount: number; setCount: number } | null
	/** null: no cardio, or neither minutes nor distance were named. */
	cardio: { minutes: number | null; distanceM: number | null } | null
}

/** The row of numbers under the header: every tile only when there is something to show. */
export const SessionTiles = ({ duration, strength, cardio }: SessionTilesProps) => {
	const { t } = useTranslation()
	if (duration === null && strength === null && cardio === null) return null

	const distance = cardio?.distanceM ? formatWorkoutDistance(cardio.distanceM, t) : null
	const cardioMinutes = cardio?.minutes ? formatWorkoutMinutes(cardio.minutes, t) : null

	return (
		<div className="flex gap-2 px-gutter">
			{duration !== null && <Tile label={t('training.session.tiles.duration')} value={duration} />}
			{strength !== null && (
				<>
					<Tile
						label={t('training.session.tiles.exercises')}
						value={formatInteger(strength.exerciseCount)}
					/>
					<Tile label={t('training.session.tiles.sets')} value={formatInteger(strength.setCount)} />
				</>
			)}
			{cardio !== null && (
				<Tile
					tone="cardio"
					label={t('muscle.CARDIO')}
					value={cardioMinutes ?? distance ?? ''}
					note={cardioMinutes === null ? null : distance}
				/>
			)}
		</div>
	)
}
