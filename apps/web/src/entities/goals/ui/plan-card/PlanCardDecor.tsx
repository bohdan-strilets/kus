import { DecorCrumb } from '@/shared/ui'

/** The blurred blobs, crumb and ring of the plan card (goals-recalc, onboarding-5-plan); decor only. */
export const PlanCardDecor = () => (
	<>
		<div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
			<span className="absolute -top-12.5 -left-10 size-35 rounded-full bg-decor-peach opacity-70 blur-xl" />
			<span className="absolute top-22.5 left-47.5 size-37.5 rounded-full bg-decor-mint opacity-60 blur-xl" />
			<DecorCrumb className="top-2 left-59 size-6.5 -rotate-25 text-crumb opacity-45" />
			<span className="absolute top-3.5 left-50 size-2.5 rounded-full border-2 border-crumb opacity-50" />
			<span className="absolute top-37.5 left-2 size-1.5 rounded-full bg-decor-peach opacity-60" />
		</div>
		{/* three bites out of the top-right corner */}
		<span
			aria-hidden="true"
			className="absolute -top-2.5 right-3.5 size-5.5 rounded-full bg-surface"
		/>
		<span
			aria-hidden="true"
			className="absolute -top-1.5 -right-1 size-5.5 rounded-full bg-surface"
		/>
		<span aria-hidden="true" className="absolute top-3 -right-2.5 size-5 rounded-full bg-surface" />
	</>
)
