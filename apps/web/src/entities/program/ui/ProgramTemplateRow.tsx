import type { ProgramTemplateDraft } from '@kus/shared'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DETAIL_SEPARATOR, GroupDot, GroupTag } from '@/entities/workout'
import { cn, expandVariants, TRANSITION } from '@/shared/lib'
import { Icon, ICON_SIZE, Text } from '@/shared/ui'

import { formatProgramTarget, formatProgramTemplateMeta } from '../lib/format-program'
import { getExerciseGroup, getTemplateGroups } from '../lib/get-template-groups'

interface ProgramTemplateRowProps {
	template: ProgramTemplateDraft
}

/** A template of a proposal: name, meta and groups; a tap unfolds its exercises with their plan. */
export const ProgramTemplateRow = ({ template }: ProgramTemplateRowProps) => {
	const { t } = useTranslation()
	const shouldReduceMotion = useReducedMotion()
	const bodyId = useId()
	const [isExpanded, setIsExpanded] = useState(false)
	const groups = getTemplateGroups(template.exercises)

	return (
		<li className="border-t border-line first:border-t-0">
			<button
				type="button"
				aria-expanded={isExpanded}
				aria-controls={bodyId}
				onClick={() => {
					setIsExpanded((current) => !current)
				}}
				className="flex min-h-tap w-full cursor-pointer items-start gap-2 py-2.5 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink"
			>
				<span className="flex min-w-0 flex-1 flex-col gap-1.5">
					<Text as="span" variant="body">
						<Text as="span" variant="body" weight="extrabold">
							{template.name}
						</Text>
						<Text as="span" variant="body" tone="mutedStrong" weight="regular">
							{DETAIL_SEPARATOR}
							{formatProgramTemplateMeta(template, t)}
						</Text>
					</Text>
					{groups.length > 0 && (
						<span className="flex flex-wrap gap-1.5">
							{groups.map((group) => (
								<GroupTag key={group} group={group} size="sm" />
							))}
						</span>
					)}
				</span>
				<Icon
					name="chevron-down"
					size={ICON_SIZE.nav}
					className={cn(
						'mt-1 flex-none text-muted transition-transform duration-(--duration-base)',
						isExpanded && 'rotate-180',
					)}
				/>
			</button>
			<AnimatePresence initial={false}>
				{isExpanded && (
					<motion.ul
						key="body"
						id={bodyId}
						variants={expandVariants}
						initial="hidden"
						animate="visible"
						exit="hidden"
						transition={shouldReduceMotion ? { duration: 0 } : TRANSITION.expand}
						className="flex flex-col gap-2.5 overflow-hidden pb-2.5"
					>
						{template.exercises.map((exercise, index) => {
							const group = getExerciseGroup(exercise)
							return (
								<li key={`${exercise.name}-${index}`} className="flex items-center gap-2">
									{group !== null && <GroupDot group={group} />}
									<Text as="span" variant="cardTitle" className="min-w-0 flex-1">
										{exercise.name}
									</Text>
									<Text
										as="span"
										variant="caption"
										tone="mutedStrong"
										className="flex-none tabular-nums"
									>
										{formatProgramTarget(exercise, t)}
									</Text>
								</li>
							)
						})}
					</motion.ul>
				)}
			</AnimatePresence>
		</li>
	)
}
