import { WORKOUT_APPEND_MAX_GAP_HOURS } from '@kus/shared'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'

import { getViewportBoxStyle, useOverlayOpen, useViewportBox } from '@/shared/lib'
import { Button, DialogCard, DialogScrim, Heading, Text } from '@/shared/ui'

interface ExitWorkoutDialogProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	/** «Зроблено 5 підходів за 23 хв.»; null when no set is done. */
	summary: string | null
	onDiscard: () => void
	isDiscarding: boolean
}

/**
 * Confirms «Вийти без збереження» only («Згорнути» just minimises). With sets done it says what is
 * made and that the session closes by itself; without them it is the title and the buttons.
 */
export const ExitWorkoutDialog = ({
	isOpen,
	onOpenChange,
	summary,
	onDiscard,
	isDiscarding,
}: ExitWorkoutDialogProps) => {
	const { t } = useTranslation()
	const viewport = useViewportBox()
	useOverlayOpen(isOpen)

	return (
		<AlertDialog.Root open={isOpen} onOpenChange={onOpenChange}>
			<AnimatePresence>
				{isOpen && (
					<AlertDialog.Portal forceMount>
						<AlertDialog.Overlay forceMount asChild>
							<DialogScrim tone="dialog" />
						</AlertDialog.Overlay>
						<div
							className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-5"
							style={getViewportBoxStyle(viewport)}
						>
							<AlertDialog.Content forceMount asChild aria-describedby={undefined}>
								<DialogCard>
									<AlertDialog.Title asChild>
										<Heading level="title">{t('training.live.exit.title')}</Heading>
									</AlertDialog.Title>
									{summary !== null && (
										<AlertDialog.Description asChild>
											<Text tone="mutedStrong">
												{t('training.live.exit.description', {
													summary,
													hours: WORKOUT_APPEND_MAX_GAP_HOURS,
													unit: t('training.live.exit.hoursUnit', {
														count: WORKOUT_APPEND_MAX_GAP_HOURS,
													}),
												})}
											</Text>
										</AlertDialog.Description>
									)}
									<div className="mt-1 flex w-full flex-col gap-2">
										<Button
											isFullWidth
											variant="secondary"
											className="text-danger"
											isLoading={isDiscarding}
											onClick={onDiscard}
										>
											{t('training.live.exit.discard')}
										</Button>
										<AlertDialog.Cancel asChild>
											<Button isFullWidth variant="textPlain">
												{t('training.live.exit.cancel')}
											</Button>
										</AlertDialog.Cancel>
									</div>
								</DialogCard>
							</AlertDialog.Content>
						</div>
					</AlertDialog.Portal>
				)}
			</AnimatePresence>
		</AlertDialog.Root>
	)
}
