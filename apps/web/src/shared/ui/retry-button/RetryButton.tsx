interface RetryButtonProps {
	label: string
	onClick: () => void
}

/** Temporary action button until the Level 0 Button lands (roadmap stage 1). */
export const RetryButton = ({ label, onClick }: RetryButtonProps) => (
	<button
		type="button"
		onClick={onClick}
		className="min-h-tap rounded-full bg-accent px-4 font-bold text-white"
	>
		{label}
	</button>
)
