import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/shared/ui'

interface RemoveProgramDialogProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	isRemoving: boolean
	onConfirm: () => void
}

/** «Прибрати програму?»: the trainings already in the journal stay. */
export const RemoveProgramDialog = ({
	isOpen,
	onOpenChange,
	isRemoving,
	onConfirm,
}: RemoveProgramDialogProps) => {
	const { t } = useTranslation()
	return (
		<ConfirmDialog
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t('program.screen.removeConfirm.title')}
			description={t('program.screen.removeConfirm.body')}
			cancelLabel={t('program.screen.removeConfirm.cancel')}
			confirmLabel={t('program.screen.removeConfirm.confirm')}
			isConfirmLoading={isRemoving}
			onConfirm={onConfirm}
		/>
	)
}
