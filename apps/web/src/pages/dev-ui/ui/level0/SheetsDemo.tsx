import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BaseBottomSheet, Button, Hamster, Surface, Text } from '@/shared/ui'

const INSTALL_HAMSTER_SIZE = 84
const INSTALL_STEP_KEYS = [
	'devUi.level0.sheetStep1',
	'devUi.level0.sheetStep2',
	'devUi.level0.sheetStep3',
] as const
const EDIT_ROW_KEYS = [
	'devUi.level0.eggs',
	'devUi.level0.buckwheat',
	'devUi.level0.coffee',
] as const

/** Both sheet layouts from the mockups: chat-edit-entry (start + close) and install-hint (centre). */
export const SheetsDemo = () => {
	const { t } = useTranslation()
	const [isEditOpen, setIsEditOpen] = useState(false)
	const [isInstallOpen, setIsInstallOpen] = useState(false)

	return (
		<>
			<div className="flex flex-wrap gap-2">
				<Button
					variant="secondary"
					size="sm"
					onClick={() => {
						setIsEditOpen(true)
					}}
				>
					{t('devUi.level0.openSheet')}
				</Button>
				<Button
					variant="secondary"
					size="sm"
					onClick={() => {
						setIsInstallOpen(true)
					}}
				>
					{t('devUi.level0.openInstallSheet')}
				</Button>
			</div>

			<BaseBottomSheet
				isOpen={isEditOpen}
				onOpenChange={setIsEditOpen}
				title={t('devUi.level0.breakfast')}
			>
				{EDIT_ROW_KEYS.map((key) => (
					<Text key={key}>{t(key)}</Text>
				))}
				<Button
					isFullWidth
					onClick={() => {
						setIsEditOpen(false)
					}}
				>
					{t('devUi.level0.save')}
				</Button>
			</BaseBottomSheet>

			<BaseBottomSheet
				isOpen={isInstallOpen}
				onOpenChange={setIsInstallOpen}
				title={t('devUi.level0.sheetTitle')}
				description={t('devUi.level0.sheetDescription')}
				hasCloseButton={false}
				titleAlign="center"
				headerSlot={<Hamster mood="wave" size={INSTALL_HAMSTER_SIZE} />}
			>
				<ol className="flex flex-col gap-2">
					{INSTALL_STEP_KEYS.map((key, index) => (
						<li key={key}>
							<Surface
								variant="field"
								radius="tile"
								shadow="none"
								className="flex items-center gap-3 px-3 py-2.5"
							>
								<span className="flex size-6.5 shrink-0 items-center justify-center rounded-full bg-surface text-caption font-extrabold">
									{index + 1}
								</span>
								<Text as="span" variant="cardTitle" weight="medium">
									{t(key)}
								</Text>
							</Surface>
						</li>
					))}
				</ol>
				<div className="flex gap-2">
					<Button
						className="flex-1"
						onClick={() => {
							setIsInstallOpen(false)
						}}
					>
						{t('devUi.level0.understood')}
					</Button>
					<Button
						variant="secondary"
						onClick={() => {
							setIsInstallOpen(false)
						}}
					>
						{t('devUi.level0.later')}
					</Button>
				</div>
			</BaseBottomSheet>
		</>
	)
}
