import { useTranslation } from 'react-i18next'

import { Icon, ICON_NAMES, ICON_SIZE, IconButton, ProgressRingIcon, Text } from '@/shared/ui'

import { SEED_EATEN_KCAL, SEED_GOAL_KCAL } from '../../model/seed'
import { DevSection } from '../DevSection'

/** Nav tabs as pairs: inactive, active (design/docs/components.md BottomNav). */
const NAV_ICON_PAIRS = [
	['chat', 'chat-filled'],
	['progress', 'progress-filled'],
	['recipes', 'recipes-filled'],
] as const

export const IconButtonsSection = () => {
	const { t } = useTranslation()

	return (
		<DevSection title={t('devUi.sections.iconButtons')}>
			<div className="flex flex-wrap items-center gap-3">
				<IconButton variant="frosted" label={t('devUi.level0.back')}>
					<Icon name="chevron-left" size={ICON_SIZE.control} />
				</IconButton>
				<IconButton label={t('common.close')}>
					<Icon name="close" size={ICON_SIZE.control} />
				</IconButton>
				<IconButton size="sm" label={t('devUi.level0.addPhoto')}>
					<Icon name="camera" size={ICON_SIZE.control} />
				</IconButton>
				<IconButton size="sm" label={t('devUi.level0.voice')}>
					<Icon name="mic" size={ICON_SIZE.control} />
				</IconButton>
				<IconButton variant="primary" label={t('devUi.level0.send')}>
					<Icon name="send" size={ICON_SIZE.control} />
				</IconButton>
				<IconButton variant="primary" label={t('devUi.level0.add')}>
					<Icon name="plus" size={ICON_SIZE.control} />
				</IconButton>
				<IconButton variant="dangerSoft" size="sm" label={t('devUi.level0.cancelRecording')}>
					<Icon name="trash" size={ICON_SIZE.control} />
				</IconButton>
				<IconButton variant="primary" disabled label={t('devUi.level0.send')}>
					<Icon name="send" size={ICON_SIZE.control} />
				</IconButton>
			</div>
			<div className="grid grid-cols-4 gap-2 rounded-tile bg-surface p-3 shadow-chip">
				<div className="flex items-center justify-center gap-2">
					<ProgressRingIcon progress={0} className="text-muted" />
					<ProgressRingIcon progress={SEED_EATEN_KCAL / SEED_GOAL_KCAL} className="text-primary" />
				</div>
				{NAV_ICON_PAIRS.map(([name, activeName]) => (
					<div key={name} className="flex items-center justify-center gap-2">
						<Icon name={name} size={ICON_SIZE.nav} className="text-muted" />
						<Icon name={activeName} size={ICON_SIZE.nav} className="text-primary" />
					</div>
				))}
			</div>
			{/* the whole pack, as in design/src/icon/icon.preview.html */}
			<div className="grid grid-cols-6 gap-2 rounded-tile bg-surface p-3 shadow-chip">
				{ICON_NAMES.map((name) => (
					<div key={name} className="flex flex-col items-center gap-1 py-1 text-ink">
						<Icon name={name} size={ICON_SIZE.nav} />
						<Text as="span" variant="small" tone="muted" className="text-center break-all">
							{name}
						</Text>
					</div>
				))}
			</div>
		</DevSection>
	)
}
