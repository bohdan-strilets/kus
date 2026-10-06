interface DemoButtonProps {
	label: string
	onClick: () => void
}

/** Dev-only trigger; Level 0 Button replaces it in stage 1 part 2. */
export const DemoButton = ({ label, onClick }: DemoButtonProps) => (
	<button
		type="button"
		onClick={onClick}
		className="min-h-tap rounded-chip bg-surface/85 px-3.5 text-caption shadow-chip transition-transform duration-fast active:scale-96"
	>
		{label}
	</button>
)
