import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { burst, CELEBRATE, type CelebrationLevel, getCenterIn, playSound } from '@/shared/lib'
import { LogoMark } from '@/shared/ui'

import { DemoButton } from '../DemoButton'
import { DevSection } from '../DevSection'

const LEVELS: readonly CelebrationLevel[] = ['kusik', 'goal', 'achieve']

export const CelebrateSection = () => {
	const { t } = useTranslation()
	const hostRef = useRef<HTMLDivElement>(null)
	const targetRef = useRef<HTMLDivElement>(null)

	const celebrate = (level: CelebrationLevel): void => {
		const host = hostRef.current
		const target = targetRef.current
		if (!host || !target) return
		const [x, y] = getCenterIn(host, target)
		burst(host, x, y, CELEBRATE[level])
		// each success level has a sound of the same name (design/docs/motion.md)
		playSound(level)
	}

	return (
		<DevSection title={t('devUi.sections.celebrate')}>
			<div
				ref={hostRef}
				className="relative flex h-40 items-center justify-center rounded-card bg-surface shadow-card"
			>
				<div ref={targetRef}>
					<LogoMark size={48} label="" />
				</div>
			</div>
			<div className="flex flex-wrap gap-2">
				{LEVELS.map((level) => (
					<DemoButton
						key={level}
						label={t(`devUi.demo.${level}`)}
						onClick={() => {
							celebrate(level)
						}}
					/>
				))}
			</div>
		</DevSection>
	)
}
