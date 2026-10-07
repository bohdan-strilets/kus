import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { formatInteger, TRANSITION } from '@/shared/lib'
import { Text } from '@/shared/ui'

import { ChoiceOption } from './ChoiceOption'

export interface ClarifyOption {
	id: string
	label: string
	kcal: number
}

export interface ClarifyCardProps {
	/** «100 г — це вага якої гречки?» */
	question: string
	/** Two answers (CLAUDE.md §6: at most 2 questions, each with its kcal). */
	options: readonly [ClarifyOption, ClarifyOption]
	selectedId: string
	onSelect: (id: string) => void
	/** «гречки» — the product named in «Запам'ятати для …». */
	productName: string
	isRemembered: boolean
	onRememberChange: (isRemembered: boolean) => void
	/** Opened by a tap on the hint: the hint button is gone, so focus moves into the card. */
	shouldFocusOnMount?: boolean
}

/**
 * docs ClarifyCard, opened under the food line it asks about (mockups/chat-clarify.html): the
 * question, two answers with their kcal and «Запам'ятати для …».
 */
export const ClarifyCard = ({
	question,
	options,
	selectedId,
	onSelect,
	productName,
	isRemembered,
	onRememberChange,
	shouldFocusOnMount = false,
}: ClarifyCardProps) => {
	const { t } = useTranslation()
	const rememberId = useId()
	const groupRef = useRef<HTMLDivElement>(null)
	// MotionConfig reducedMotion only skips transforms; a height animation has to be skipped here
	const shouldReduceMotion = useReducedMotion()

	useEffect(() => {
		if (shouldFocusOnMount) groupRef.current?.focus()
	}, [shouldFocusOnMount])

	return (
		<motion.div
			initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
			animate={{ height: 'auto', opacity: 1 }}
			transition={TRANSITION.expand}
			className="overflow-hidden"
		>
			<div
				ref={groupRef}
				tabIndex={-1}
				role="group"
				aria-label={question}
				className="mx-1.5 mt-0.5 mb-1.5 flex flex-col gap-2 rounded-tile bg-primary-selected p-2.5 focus-visible:outline-none"
			>
				<Text as="span" variant="caption" weight="bold">
					{question}
				</Text>
				<div className="grid grid-cols-2 gap-1.5">
					{options.map((option) => (
						<ChoiceOption
							key={option.id}
							label={option.label}
							detail={t('entry.kcal', { kcal: formatInteger(option.kcal) })}
							isSelected={option.id === selectedId}
							onSelect={() => {
								onSelect(option.id)
							}}
						/>
					))}
				</div>
				{/* a native checkbox is already accessible; accent-primary paints it like the mockup */}
				<label
					htmlFor={rememberId}
					className="flex min-h-tap cursor-pointer items-center gap-2 text-caption"
				>
					<input
						id={rememberId}
						type="checkbox"
						checked={isRemembered}
						onChange={(event) => {
							onRememberChange(event.target.checked)
						}}
						className="size-4.5 accent-primary"
					/>
					{t('entry.remember', { name: productName })}
				</label>
			</div>
		</motion.div>
	)
}
