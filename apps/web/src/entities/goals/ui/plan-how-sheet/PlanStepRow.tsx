import { Text } from '@/shared/ui'

import type { PlanStep } from '../../model/plan-step.types'

export interface PlanStepRowProps {
	/** 1-based number shown in the badge. */
	index: number
	step: PlanStep
}

/** One step of «Як я порахував»: the number, the title with its formula, and the result. */
export const PlanStepRow = ({ index, step }: PlanStepRowProps) => (
	<li className="grid grid-cols-[26px_minmax(0,1fr)_auto] items-start gap-2.5 border-b border-divider py-2.5">
		<span
			aria-hidden="true"
			className="flex size-6.5 items-center justify-center rounded-full bg-primary-soft text-caption font-extrabold text-primary-deep"
		>
			{index}
		</span>
		<span className="flex min-w-0 flex-col gap-0.5">
			<Text as="span" variant="cardTitle">
				{step.title}
			</Text>
			<Text as="span" variant="small" weight="regular" tone="muted" isTabular>
				{step.formula}
			</Text>
		</span>
		<Text as="span" variant="body" weight="extrabold" isTabular className="whitespace-nowrap">
			{step.value}
		</Text>
	</li>
)
