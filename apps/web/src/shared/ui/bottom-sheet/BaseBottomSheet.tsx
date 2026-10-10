import * as Dialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion, type PanInfo, useDragControls } from 'motion/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
	cn,
	focusDialogContainer,
	focusFirstField,
	getViewportBoxStyle,
	sheetVariants,
	useViewportBox,
} from '@/shared/lib'

import { DialogScrim } from '../dialog-scrim'
import { Heading } from '../heading'
import { Icon } from '../icon'
import { IconButton } from '../icon-button'
import { Text } from '../text'
import {
	CLOSE_DRAG_OFFSET_PX,
	CLOSE_DRAG_VELOCITY,
	CLOSE_ICON_SIZE,
	DRAG_ELASTIC,
} from './bottom-sheet.constants'

export interface BaseBottomSheetProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	title: string
	/** Read by screen readers with the title; shown under it. */
	description?: string
	/** The 44px «Закрити» button (chat-edit-entry). install-hint has none. */
	hasCloseButton?: boolean
	/** start — title left, close right (chat-edit-entry); center — everything centred (install-hint). */
	titleAlign?: 'start' | 'center'
	/** E.g. <Hamster size={84} /> in install-hint, or the head before the title in plan-how. */
	headerSlot?: ReactNode
	/** above — over the title (install-hint, default); start — in the row, before the title (plan-how). */
	headerSlotPlacement?: 'above' | 'start'
	/** What gets focus on open: the sheet itself (default), or the first field of a form sheet. */
	initialFocus?: 'container' | 'first-field'
	children: ReactNode
}

/**
 * docs Sheet: from the bottom, radius 28 on top, shadow-sheet, padding 10 16 28, a 40×5 grabber,
 * an optional 44px close button. Always closes on Esc, a tap on the scrim and a swipe down,
 * with or without the button (Radix Dialog + Motion).
 */
export const BaseBottomSheet = ({
	isOpen,
	onOpenChange,
	title,
	description,
	hasCloseButton = true,
	titleAlign = 'start',
	headerSlot,
	headerSlotPlacement = 'above',
	initialFocus = 'container',
	children,
}: BaseBottomSheetProps) => {
	const isCentered = titleAlign === 'center'
	const isSlotAtStart = headerSlotPlacement === 'start'
	const { t } = useTranslation()
	const viewport = useViewportBox()
	// dragging starts only from the grabber and header, so the body can scroll and select text
	const dragControls = useDragControls()

	const handleDragEnd = (_event: PointerEvent, info: PanInfo): void => {
		const isFarEnough = info.offset.y > CLOSE_DRAG_OFFSET_PX
		const isFastEnough = info.velocity.y > CLOSE_DRAG_VELOCITY
		if (isFarEnough || isFastEnough) onOpenChange(false)
	}

	return (
		<Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
			<AnimatePresence>
				{isOpen && (
					<Dialog.Portal forceMount>
						<Dialog.Overlay forceMount asChild>
							<DialogScrim />
						</Dialog.Overlay>
						{/* caps the sheet at the screen below the notch; the body scrolls, the header stays */}
						{/* sized to the part of the screen above the keyboard (iOS doesn't shrink the layout viewport) */}
						<div
							className="pointer-events-none fixed inset-0 z-50 flex flex-col justify-end pt-safe-top"
							style={getViewportBoxStyle(viewport)}
						>
							<Dialog.Content
								forceMount
								asChild
								onOpenAutoFocus={
									initialFocus === 'first-field' ? focusFirstField : focusDialogContainer
								}
								// without a description Radix wants the attribute explicitly empty
								{...(description ? {} : { 'aria-describedby': undefined })}
							>
								<motion.div
									className="pointer-events-auto mx-auto flex max-h-full w-full max-w-app flex-col rounded-t-sheet bg-surface pb-safe-bottom shadow-sheet focus-visible:outline-none"
									variants={sheetVariants}
									initial="hidden"
									animate="visible"
									exit="hidden"
									drag="y"
									dragListener={false}
									dragControls={dragControls}
									dragConstraints={{ top: 0, bottom: 0 }}
									dragElastic={DRAG_ELASTIC}
									onDragEnd={handleDragEnd}
								>
									<div
										className="flex touch-none flex-col gap-3.5 px-4 pt-2.5"
										onPointerDown={(event) => {
											dragControls.start(event)
										}}
									>
										<span
											aria-hidden="true"
											className="h-1.25 w-10 self-center rounded-full bg-handle"
										/>
										<div
											className={cn(
												'relative flex gap-3',
												isCentered
													? 'flex-col items-center text-center'
													: 'items-center justify-between',
											)}
										>
											{isSlotAtStart && headerSlot}
											<div
												className={cn(
													'flex min-w-0 flex-col',
													isCentered ? 'items-center gap-2' : 'gap-1',
													isSlotAtStart && 'flex-1',
												)}
											>
												{!isSlotAtStart && headerSlot}
												<Dialog.Title asChild>
													<Heading level="title">{title}</Heading>
												</Dialog.Title>
												{description && (
													<Dialog.Description asChild>
														{isCentered ? (
															// install-hint: 14/1.45 muted-strong under a centred title
															<Text variant="cardTitle" weight="medium" tone="mutedStrong">
																{description}
															</Text>
														) : (
															<Text variant="caption" tone="muted">
																{description}
															</Text>
														)}
													</Dialog.Description>
												)}
											</div>
											{hasCloseButton && (
												<Dialog.Close asChild>
													<IconButton
														label={t('common.close')}
														className={cn(isCentered && 'absolute top-0 right-0')}
													>
														<Icon name="close" size={CLOSE_ICON_SIZE} />
													</IconButton>
												</Dialog.Close>
											)}
										</div>
									</div>
									<div className="flex min-h-0 flex-col gap-3.5 overflow-y-auto px-4 pt-3.5 pb-7">
										{children}
									</div>
								</motion.div>
							</Dialog.Content>
						</div>
					</Dialog.Portal>
				)}
			</AnimatePresence>
		</Dialog.Root>
	)
}
