import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { type PointerEvent, useEffect, useId, useRef } from 'react'

import { cn, TRANSITION } from '@/shared/lib'

import { Icon, ICON_SIZE } from '../icon'
import { Text } from '../text'
import { SWIPE_ACTION_WIDTH_PX } from './swipe-to-delete.constants'
import { getSwipeOutcome, isHorizontalSwipe } from './swipe-to-delete.lib'
import type { SwipeToDeleteProps } from './swipe-to-delete.types'
import { swipeActionVariants, swipeFrameVariants } from './swipe-to-delete.variants'
import { SWIPE_ROW_ATTRIBUTE, useSwipeOpen } from './use-swipe-open'

/** Rows can nest (a set inside a card): the innermost one claims the touch, the outer ones ignore it. */
const claimedTouches = new WeakSet<Event>()

type GesturePhase = 'pending' | 'swipe' | 'scroll'

interface Gesture {
	pointerId: number
	startX: number
	startY: number
	/** Where the row was when the finger came down (0, or the open position). */
	originX: number
	width: number
	phase: GesturePhase
}

/**
 * design/docs/motion.md «Живий режим» п. 4: the row follows the finger 1:1 (`touch-action: pan-y`,
 * so the page still scrolls), a release decides by `getSwipeOutcome`. The action is also reachable
 * without a swipe (the caller keeps a 44px button); this one is hidden from assistive tech until open.
 */
export const SwipeToDelete = ({
	children,
	actionLabel,
	actionAriaLabel,
	variant = 'danger',
	radius = 'tile',
	isDisabled = false,
	onAction,
}: SwipeToDeleteProps) => {
	const id = useId()
	const { isOpen, setIsOpen } = useSwipeOpen(id)
	const isReduced = useReducedMotion()
	const x = useMotionValue(0)
	const actionOpacity = useTransform(x, (value) => (value < 0 ? 1 : 0))
	const contentBackground = useTransform(x, (value) =>
		value < 0 ? 'var(--color-surface)' : 'transparent',
	)
	const frameRef = useRef<HTMLDivElement>(null)
	const gesture = useRef<Gesture | null>(null)
	const didSwipe = useRef(false)

	const settle = (target: number): void => {
		if (isReduced) x.set(target)
		else void animate(x, target, TRANSITION.base)
	}

	// the group (or a tap outside) closed the row: bring it back; a finger in control is left alone
	useEffect(() => {
		if (gesture.current !== null) return
		const target = isOpen ? -SWIPE_ACTION_WIDTH_PX : 0
		if (x.get() === target) return
		if (isReduced) x.set(target)
		else void animate(x, target, TRANSITION.base)
	}, [isOpen, isReduced, x])

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
		if (isDisabled || (event.pointerType === 'mouse' && event.button !== 0)) return
		if (claimedTouches.has(event.nativeEvent)) return
		claimedTouches.add(event.nativeEvent)
		didSwipe.current = false
		gesture.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originX: x.get(),
			width: frameRef.current?.offsetWidth ?? 0,
			phase: 'pending',
		}
	}

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
		const current = gesture.current
		if (current === null || current.pointerId !== event.pointerId) return
		const dx = event.clientX - current.startX
		const dy = event.clientY - current.startY
		if (current.phase === 'pending') {
			if (isHorizontalSwipe(dx, dy)) {
				current.phase = 'swipe'
				didSwipe.current = true
				event.currentTarget.setPointerCapture(event.pointerId)
			} else if (Math.abs(dy) > Math.abs(dx)) {
				return
			}
		}
		if (current.phase !== 'swipe') return
		x.set(Math.min(0, Math.max(-current.width, current.originX + dx)))
	}

	const handlePointerEnd = (event: PointerEvent<HTMLDivElement>): void => {
		const current = gesture.current
		if (current === null || current.pointerId !== event.pointerId) return
		gesture.current = null
		if (current.phase !== 'swipe') return
		const outcome = getSwipeOutcome(x.get(), current.width)
		if (outcome === 'commit') {
			setIsOpen(false)
			x.set(0)
			onAction(frameRef.current)
			return
		}
		setIsOpen(outcome === 'open')
		settle(outcome === 'open' ? -SWIPE_ACTION_WIDTH_PX : 0)
	}

	// the click that ends a swipe is not a tap; a tap on an open row only closes it
	const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>): void => {
		if (didSwipe.current) {
			didSwipe.current = false
			event.stopPropagation()
			event.preventDefault()
			return
		}
		if (!isOpen) return
		event.stopPropagation()
		event.preventDefault()
		setIsOpen(false)
	}

	return (
		<div
			ref={frameRef}
			{...{ [SWIPE_ROW_ATTRIBUTE]: id }}
			className={swipeFrameVariants({ radius })}
		>
			<motion.div
				inert={!isOpen}
				style={{ opacity: actionOpacity }}
				className={swipeActionVariants({ variant })}
			>
				<button
					type="button"
					aria-label={actionAriaLabel}
					onClick={() => {
						setIsOpen(false)
						x.set(0)
						onAction(frameRef.current)
					}}
					className="flex w-22 cursor-pointer flex-col items-center justify-center gap-0.5"
				>
					<Icon name={variant === 'danger' ? 'trash' : 'close'} size={ICON_SIZE.nav} />
					<Text as="span" variant="small" weight="bold" className={cn('text-inherit')}>
						{actionLabel}
					</Text>
				</button>
			</motion.div>
			<motion.div
				style={{ x, backgroundColor: contentBackground }}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerEnd}
				onPointerCancel={handlePointerEnd}
				onClickCapture={handleClickCapture}
				data-swipe-content=""
				className="relative"
			>
				{children}
			</motion.div>
		</div>
	)
}
