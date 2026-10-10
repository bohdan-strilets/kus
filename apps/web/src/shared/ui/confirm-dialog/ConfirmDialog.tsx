import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { AnimatePresence } from 'motion/react'
import type { ReactNode } from 'react'

import { getViewportBoxStyle, useViewportBox } from '@/shared/lib'

import { Button } from '../button'
import { DialogCard } from '../dialog-card'
import { DialogScrim } from '../dialog-scrim'
import { Heading } from '../heading'
import { Text } from '../text'

export interface ConfirmDialogProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	title: string
	description: string
	/** «Скасувати» — focused by default, Esc does the same. */
	cancelLabel: string
	/** The destructive action, e.g. «Видалити все». */
	confirmLabel: string
	onConfirm: () => void
	/** e.g. the password field is still empty. */
	isConfirmDisabled?: boolean
	/** The action is running: blocks repeat taps and shows the loader. */
	isConfirmLoading?: boolean
	/** What is happening, e.g. «Видаляю…». */
	confirmLoadingText?: string
	/** e.g. a decorative <Hamster mood="oops" size={90} />. */
	illustration?: ReactNode
	/** Between the text and the buttons, e.g. «Спершу експортувати дані». */
	children?: ReactNode
}

/**
 * «Are you sure?» for destructive actions (mockups/settings-delete-confirm.html, role="alertdialog"):
 * a tap on the scrim does nothing, Esc cancels, focus starts on «Скасувати», the action is danger.
 * «Confirm» never closes the dialog by itself: the caller closes it through `onOpenChange(false)`,
 * so a failed action (wrong password) leaves it open.
 */
export const ConfirmDialog = ({
	isOpen,
	onOpenChange,
	title,
	description,
	cancelLabel,
	confirmLabel,
	onConfirm,
	isConfirmDisabled = false,
	isConfirmLoading = false,
	confirmLoadingText,
	illustration,
	children,
}: ConfirmDialogProps) => {
	const viewport = useViewportBox()

	return (
		<AlertDialog.Root open={isOpen} onOpenChange={onOpenChange}>
			<AnimatePresence>
				{isOpen && (
					<AlertDialog.Portal forceMount>
						<AlertDialog.Overlay forceMount asChild>
							<DialogScrim tone="dialog" />
						</AlertDialog.Overlay>
						{/* sized to the part of the screen above the keyboard (the password field) */}
						<div
							className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-5"
							style={getViewportBoxStyle(viewport)}
						>
							<AlertDialog.Content forceMount asChild>
								<DialogCard>
									{illustration}
									<AlertDialog.Title asChild>
										<Heading level="title">{title}</Heading>
									</AlertDialog.Title>
									<AlertDialog.Description asChild>
										<Text tone="mutedStrong">{description}</Text>
									</AlertDialog.Description>
									{children}
									<div className="mt-1 grid w-full grid-cols-2 gap-2">
										<AlertDialog.Cancel asChild>
											<Button variant="secondary">{cancelLabel}</Button>
										</AlertDialog.Cancel>
										<AlertDialog.Action asChild>
											<Button
												variant="danger"
												disabled={isConfirmDisabled}
												isLoading={isConfirmLoading}
												loadingText={confirmLoadingText}
												// settings-delete-confirm: a disabled action is at 0.4
												className={isConfirmDisabled ? 'opacity-40' : undefined}
												onClick={(event) => {
													// Radix would close the dialog on Action; the caller decides when
													event.preventDefault()
													onConfirm()
												}}
											>
												{confirmLabel}
											</Button>
										</AlertDialog.Action>
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
