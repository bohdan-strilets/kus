import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BaseModal, Button, ConfirmDialog, Hamster, useToast } from '@/shared/ui'

const DIALOG_HAMSTER_SIZE = 90

/** ConfirmDialog as in settings-delete-confirm, a plain BaseModal and a toast. */
export const DialogsDemo = () => {
	const { t } = useTranslation()
	const toast = useToast()
	const [isConfirmOpen, setIsConfirmOpen] = useState(false)
	const [isModalOpen, setIsModalOpen] = useState(false)

	const closeModal = (): void => {
		setIsModalOpen(false)
	}

	return (
		<>
			<div className="flex flex-wrap gap-2">
				<Button
					variant="secondary"
					size="sm"
					onClick={() => {
						setIsConfirmOpen(true)
					}}
				>
					{t('devUi.level0.openConfirm')}
				</Button>
				<Button
					variant="secondary"
					size="sm"
					onClick={() => {
						setIsModalOpen(true)
					}}
				>
					{t('devUi.level0.openModal')}
				</Button>
				<Button
					variant="secondary"
					size="sm"
					onClick={() => {
						toast.show(t('devUi.level0.toastMessage'))
					}}
				>
					{t('devUi.level0.showToast')}
				</Button>
			</div>

			<ConfirmDialog
				isOpen={isConfirmOpen}
				onOpenChange={setIsConfirmOpen}
				title={t('devUi.level0.title')}
				description={t('devUi.level0.modalDescription')}
				cancelLabel={t('devUi.level0.cancel')}
				confirmLabel={t('devUi.level0.deleteAll')}
				onConfirm={() => {
					setIsConfirmOpen(false)
					toast.show(t('devUi.level0.deleteAll'))
				}}
				illustration={<Hamster mood="oops" size={DIALOG_HAMSTER_SIZE} />}
			>
				<Button variant="text">{t('devUi.level0.exportFirst')}</Button>
			</ConfirmDialog>

			<BaseModal
				isOpen={isModalOpen}
				onOpenChange={setIsModalOpen}
				title={t('devUi.level0.modalPlainTitle')}
				description={t('devUi.level0.modalPlainText')}
				actions={<Button onClick={closeModal}>{t('devUi.level0.understood')}</Button>}
			/>
		</>
	)
}
