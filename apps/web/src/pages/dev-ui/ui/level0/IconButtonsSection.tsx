import { CaretLeftIcon, PlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import {
	CameraIcon,
	IconButton,
	MicIcon,
	NavChatIcon,
	NavProgressIcon,
	NavRecipesIcon,
	NavTodayIcon,
	SendIcon,
} from '@/shared/ui'

import { DevSection } from '../DevSection'

const PHOSPHOR_SIZE = 18
const NAV_ICONS = [NavChatIcon, NavTodayIcon, NavProgressIcon, NavRecipesIcon] as const

export const IconButtonsSection = () => {
	const { t } = useTranslation()

	return (
		<DevSection title={t('devUi.sections.iconButtons')}>
			<div className="flex flex-wrap items-center gap-3">
				<IconButton variant="frosted" label={t('devUi.level0.back')}>
					<CaretLeftIcon aria-hidden size={PHOSPHOR_SIZE} weight="bold" />
				</IconButton>
				<IconButton label={t('common.close')}>
					<XIcon aria-hidden size={PHOSPHOR_SIZE} weight="bold" />
				</IconButton>
				<IconButton size="sm" label={t('devUi.level0.addPhoto')}>
					<CameraIcon />
				</IconButton>
				<IconButton size="sm" label={t('devUi.level0.voice')}>
					<MicIcon />
				</IconButton>
				<IconButton variant="primary" label={t('devUi.level0.send')}>
					<SendIcon />
				</IconButton>
				<IconButton variant="primary" label={t('devUi.level0.add')}>
					<PlusIcon aria-hidden size={PHOSPHOR_SIZE} weight="bold" />
				</IconButton>
				<IconButton variant="dangerSoft" size="sm" label={t('devUi.level0.cancelRecording')}>
					<TrashIcon aria-hidden size={PHOSPHOR_SIZE} />
				</IconButton>
				<IconButton variant="primary" disabled label={t('devUi.level0.send')}>
					<SendIcon />
				</IconButton>
			</div>
			<div className="grid grid-cols-4 gap-2 rounded-tile bg-surface p-3 shadow-chip">
				{NAV_ICONS.map((Icon, index) => (
					<div key={index} className="flex items-center justify-center gap-2">
						<Icon className="text-muted" />
						<Icon isActive className="text-primary" />
					</div>
				))}
			</div>
		</DevSection>
	)
}
