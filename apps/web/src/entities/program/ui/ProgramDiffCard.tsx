import type { ProgramCard } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { Text } from '@/shared/ui'

import { getProgramChangeGroups } from '../lib/format-program-changes'
import type { ProgramCardControls } from './program-card.types'
import { ProgramCardFrame } from './ProgramCardFrame'
import { ProgramChangeList } from './ProgramChangeList'

interface ProgramDiffCardProps {
	card: ProgramCard
	controls: ProgramCardControls
}

/** «Зміни в програмі» (mockups/chat-program.html): what the new version changes, one «Прийняти». */
export const ProgramDiffCard = ({ card, controls }: ProgramDiffCardProps) => {
	const { t } = useTranslation()
	const groups = getProgramChangeGroups(card.changes, card.program, t)
	return (
		<ProgramCardFrame controls={controls} note={t('program.diff.note')}>
			<Text as="p" role="heading" aria-level={3} variant="body" weight="extrabold">
				{t('program.diff.title')}
			</Text>
			<ProgramChangeList groups={groups} />
		</ProgramCardFrame>
	)
}
