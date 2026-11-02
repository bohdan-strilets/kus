import { type ProgramMode, programModeSchema } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatRotateHint, type ProgramTemplateResponse } from '@/entities/program'
import { SegmentedToggle, Text } from '@/shared/ui'

interface ProgramModeSectionProps {
	mode: ProgramMode
	templates: readonly ProgramTemplateResponse[]
	onChange: (mode: ProgramMode) => void
}

const MODES = programModeSchema.options

/** «Як чергувати»: the mode and what it means for the «next» training. */
export const ProgramModeSection = ({ mode, templates, onChange }: ProgramModeSectionProps) => {
	const { t } = useTranslation()
	return (
		<>
			<Text as="p" variant="eyebrow" tone="muted" className="mt-1.5 px-1">
				{t('program.screen.modeLabel')}
			</Text>
			<SegmentedToggle
				size="tall"
				aria-label={t('program.screen.modeLabel')}
				value={mode}
				onChange={onChange}
				options={MODES.map((value) => ({ value, label: t(`program.mode.${value}`) }))}
			/>
			<Text as="p" variant="caption" tone="muted" weight="regular" className="px-1">
				{mode === 'ROTATE' ? formatRotateHint(templates, t) : t(`program.screen.hint.${mode}`)}
			</Text>
		</>
	)
}
