import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence } from 'motion/react'
import type { ReactNode } from 'react'

import { focusDialogContainer, getViewportBoxStyle, useViewportBox } from '@/shared/lib'

import { DialogCard } from '../dialog-card'
import { DialogScrim } from '../dialog-scrim'
import { Heading } from '../heading'
import { Text } from '../text'

export interface BaseModalProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	title: string
	description?: string
	/** e.g. a decorative <Hamster size={90} /> above the title. */
	illustration?: ReactNode
	/** Extra content between the text and the actions. */
	children?: ReactNode
	/** Buttons in a row; two buttons split the width equally. */
	actions: ReactNode
}

/**
 * A regular centred dialog (docs Dialog): Esc and a tap on the scrim close it (Radix Dialog).
 * For «are you sure?» confirmations use ConfirmDialog — it is an alertdialog and doesn't close
 * on a scrim tap.
 */
export const BaseModal = ({
	isOpen,
	onOpenChange,
	title,
	description,
	illustration,
	children,
	actions,
}: BaseModalProps) => {
	const viewport = useViewportBox()

	return (
		<Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
			<AnimatePresence>
				{isOpen && (
					<Dialog.Portal forceMount>
						<Dialog.Overlay forceMount asChild>
							<DialogScrim tone="dialog" />
						</Dialog.Overlay>
						{/* sized to the part of the screen above the keyboard (iOS doesn't shrink the layout viewport) */}
						<div
							className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-5"
							style={getViewportBoxStyle(viewport)}
						>
							<Dialog.Content
								forceMount
								asChild
								onOpenAutoFocus={focusDialogContainer}
								{...(description ? {} : { 'aria-describedby': undefined })}
							>
								<DialogCard>
									{illustration}
									<Dialog.Title asChild>
										<Heading level="title">{title}</Heading>
									</Dialog.Title>
									{description && (
										<Dialog.Description asChild>
											<Text tone="mutedStrong">{description}</Text>
										</Dialog.Description>
									)}
									{children}
									<div className="mt-1 grid w-full auto-cols-fr grid-flow-col gap-2">{actions}</div>
								</DialogCard>
							</Dialog.Content>
						</div>
					</Dialog.Portal>
				)}
			</AnimatePresence>
		</Dialog.Root>
	)
}
