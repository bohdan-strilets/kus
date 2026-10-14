import { useTranslation } from 'react-i18next'

import {
	Hamster,
	HAMSTER_LABEL_KEYS,
	HamsterHead,
	type HamsterHeadMood,
	type HamsterMood,
} from '@/shared/ui'

import { DevSection } from '../DevSection'

const BODY_SIZE = 96
// the label keys list every mood, so the catalogue never misses a new one
const MOODS = Object.keys(HAMSTER_LABEL_KEYS) as HamsterMood[]
const HEAD_MOODS: readonly HamsterHeadMood[] = [
	'smile',
	'smileOpen',
	'happy',
	'think',
	'proud',
	'content',
	'oops',
	'hungry',
]
const HEAD_SIZE = 34
// the medal of «proud»: one digit and three characters (smaller font); the star is the plain proud above
const PROUD_BADGES: readonly (number | string)[] = [7, '105']

export const HamsterSection = () => {
	const { t } = useTranslation()

	return (
		<>
			<DevSection title={t('devUi.sections.hamster')}>
				<div className="grid grid-cols-3 gap-3">
					{MOODS.map((mood) => (
						<figure
							key={mood}
							className="flex flex-col items-center gap-1 rounded-tile bg-surface p-2 shadow-chip"
						>
							<Hamster mood={mood} size={BODY_SIZE} label={t(HAMSTER_LABEL_KEYS[mood])} />
							<figcaption className="text-small text-muted">{mood}</figcaption>
						</figure>
					))}
					{PROUD_BADGES.map((badge) => (
						<figure
							key={badge}
							className="flex flex-col items-center gap-1 rounded-tile bg-surface p-2 shadow-chip"
						>
							<Hamster
								mood="proud"
								size={BODY_SIZE}
								badge={badge}
								label={t(HAMSTER_LABEL_KEYS.proud)}
							/>
							<figcaption className="text-small text-muted">proud · {badge}</figcaption>
						</figure>
					))}
				</div>
			</DevSection>

			<DevSection title={t('devUi.sections.heads')}>
				<div className="grid grid-cols-4 gap-4">
					{HEAD_MOODS.map((mood) => (
						<figure key={mood} className="flex flex-col items-center gap-1">
							<HamsterHead mood={mood} size={HEAD_SIZE} />
							<figcaption className="text-small text-muted">{mood}</figcaption>
						</figure>
					))}
				</div>
			</DevSection>
		</>
	)
}
