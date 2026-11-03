import type { ProgramResponse, ProgramTemplateResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { formatProgramTemplateMeta } from '@/entities/program'
import { StartWorkoutButtons } from '@/features/live-workout'
import { TRAINING_PROGRAM_ROUTE } from '@/shared/config'
import { Button, Icon, ICON_SIZE, ScreenHeader } from '@/shared/ui'

import { useTemplateEditor } from '../model/use-template-editor'
import { getEditedEstimateMin } from '../lib/get-edited-estimate'
import { TemplateEditor } from './TemplateEditor'
import { TemplateView } from './TemplateView'

interface TemplateScreenProps {
	program: ProgramResponse
	template: ProgramTemplateResponse
}

/** One day of the program: the view with «Змінити», or the editor with «Готово». */
export const TemplateScreen = ({ program, template }: TemplateScreenProps) => {
	const { t } = useTranslation()
	const editor = useTemplateEditor({ program, template })
	const estimatedMin = editor.isEditing
		? getEditedEstimateMin(editor.exercises)
		: template.estimatedMin

	return (
		<div className="flex flex-1 flex-col">
			<ScreenHeader
				title={template.name}
				subtitle={formatProgramTemplateMeta({ exercises: editor.exercises, estimatedMin }, t)}
				backTo={TRAINING_PROGRAM_ROUTE}
				action={
					editor.isEditing ? (
						<Button
							variant="dark"
							size="header"
							isLoading={editor.isSaving}
							loadingText={t('program.editor.saving')}
							disabled={editor.isDoneDisabled}
							onClick={editor.finishEditing}
						>
							{t('program.editor.done')}
						</Button>
					) : (
						<Button
							variant="frosted"
							size="header"
							icon={<Icon name="edit" size={ICON_SIZE.small} />}
							onClick={editor.startEditing}
						>
							{t('program.editor.edit')}
						</Button>
					)
				}
			/>
			<div className="flex flex-1 flex-col gap-2.5 px-gutter pt-1 pb-4">
				{editor.isEditing ? (
					<TemplateEditor exercises={editor.exercises} dispatch={editor.dispatch} />
				) : (
					<TemplateView exercises={editor.exercises} />
				)}
				{!editor.isEditing && (
					<StartWorkoutButtons templateId={template.id} className="mt-auto pt-1" />
				)}
			</div>
		</div>
	)
}
