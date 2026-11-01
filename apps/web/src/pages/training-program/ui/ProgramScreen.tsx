import type { ProgramResponse } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { toggleWeekday } from '@/entities/program'
import { useRemoveProgram } from '@/features/remove-program'
import { useComposerDraftStore } from '@/features/send-message'
import { useUpdateProgramSettings } from '@/features/update-program-settings'
import { ROUTES } from '@/shared/config'
import { Button, useToast } from '@/shared/ui'

import { ProgramModeSection } from './ProgramModeSection'
import { ProgramTemplateCard } from './ProgramTemplateCard'
import { ProgramVersionRow } from './ProgramVersionRow'
import { ProgramVersionsSheet } from './ProgramVersionsSheet'
import { RemoveProgramDialog } from './RemoveProgramDialog'

interface ProgramScreenProps {
	program: ProgramResponse
}

/** The body of the screen: version row, mode, the days, «Змінити в чаті» and «Прибрати програму». */
export const ProgramScreen = ({ program }: ProgramScreenProps) => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const toast = useToast()
	const { updateSettings, updateWeekdays } = useUpdateProgramSettings()
	const removeProgram = useRemoveProgram()
	const [isVersionsOpen, setIsVersionsOpen] = useState(false)
	const [isRemoveOpen, setIsRemoveOpen] = useState(false)

	const isBusy = updateSettings.isPending || updateWeekdays.isPending
	// the toggle answers at once; the server's answer replaces the program a moment later
	const shownMode = (updateSettings.isPending && updateSettings.variables.mode) || program.mode
	const showActionError = (): void => {
		toast.show(t('program.screen.actionError'))
	}

	return (
		<>
			<ProgramVersionRow
				createdAt={program.version.createdAt}
				onOpen={() => {
					setIsVersionsOpen(true)
				}}
			/>
			<ProgramModeSection
				mode={shownMode}
				onChange={(mode) => {
					if (isBusy || mode === program.mode) return
					updateSettings.mutate({ mode }, { onError: showActionError })
				}}
			/>
			{program.templates.map((template) => (
				<ProgramTemplateCard
					key={template.id}
					template={template}
					mode={shownMode}
					isNext={program.next?.templateId === template.id}
					isPinned={program.pinnedTemplateId === template.id}
					isBusy={isBusy}
					onPin={() => {
						if (isBusy || program.pinnedTemplateId === template.id) return
						updateSettings.mutate({ pinnedTemplateId: template.id }, { onError: showActionError })
					}}
					onToggleWeekday={(isoWeekday) => {
						if (isBusy) return
						updateWeekdays.mutate(
							{
								templateId: template.id,
								weekdays: toggleWeekday(template.weekdays, isoWeekday),
							},
							{ onError: showActionError },
						)
					}}
				/>
			))}
			<div className="flex flex-col gap-1 pt-1">
				<Button
					variant="secondary"
					onClick={() => {
						useComposerDraftStore.getState().requestFocus()
						void navigate(ROUTES.chat)
					}}
				>
					{t('program.card.modify')}
				</Button>
				<Button
					variant="textPlain"
					onClick={() => {
						setIsRemoveOpen(true)
					}}
				>
					{t('program.screen.remove')}
				</Button>
			</div>
			<ProgramVersionsSheet
				isOpen={isVersionsOpen}
				onOpenChange={setIsVersionsOpen}
				program={program}
			/>
			<RemoveProgramDialog
				isOpen={isRemoveOpen}
				onOpenChange={setIsRemoveOpen}
				isRemoving={removeProgram.isPending}
				onConfirm={() => {
					// on success the program is gone from the cache and the page leaves for the training tab
					removeProgram.mutate(undefined, {
						onError: () => {
							setIsRemoveOpen(false)
							showActionError()
						},
					})
				}}
			/>
		</>
	)
}
