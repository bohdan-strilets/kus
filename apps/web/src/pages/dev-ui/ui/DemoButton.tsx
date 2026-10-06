import { Button } from '@/shared/ui'

interface DemoButtonProps {
	label: string
	onClick: () => void
}

/** Dev-page trigger: the small secondary Button with a label prop. */
export const DemoButton = ({ label, onClick }: DemoButtonProps) => (
	<Button variant="secondary" size="sm" onClick={onClick}>
		{label}
	</Button>
)
