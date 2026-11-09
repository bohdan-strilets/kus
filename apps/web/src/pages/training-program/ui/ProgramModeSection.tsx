import { type ProgramMode, programModeSchema } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatRotateHintParts, type ProgramTemplateResponse } from '@/entities/program'
import { SegmentedToggle, Text } from '@/shared/ui'

interface ProgramModeSectionProps {
	mode: ProgramMode
	templates: readonly ProgramTemplateResponse[]
	onChange: (mode: ProgramMode) => void
}

const MODES = programModeSchema.options

/** Custom names are long: the sequence takes one line cut with «…», the full text is in the title. */
const RotateHint = ({ templates }: { templates: readonly ProgramTemplateResponse[] }) => {
	const { t } = useTranslation()
	const { sequence, isTruncatable, next } = formatRotateHintParts(templates, t)
	if (sequence === null || !isTruncatable)
		return (
			<Text as="p" variant="caption" tone="muted" weight="regular" className="px-1">
				{sequence === null ? next : t('program.screen.hint.ROTATE', { sequence, next })}
			</Text>
		)
	return (
		<div className="flex flex-col gap-0.5 px-1">
			<Text
				as="p"
				variant="caption"
				tone="muted"
				weight="regular"
				className="truncate"
				title={sequence}
			>
				{sequence}
			</Text>
			<Text as="p" variant="caption" tone="muted" weight="regular">
				{next}
			</Text>
		</div>
	)
}

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
			{mode === 'ROTATE' ? (
				<RotateHint templates={templates} />
			) : (
				<Text as="p" variant="caption" tone="muted" weight="regular" className="px-1">
					{t(`program.screen.hint.${mode}`)}
				</Text>
			)}
		</>
	)
}
