import type { ReactNode } from 'react'

import { Text } from '@/shared/ui'

interface PreviewFrameProps {
	/** The mockup it mirrors, e.g. «chat-clarify» — also the data-preview hook for screenshots. */
	mockup: string
	children: ReactNode
}

/** Full-bleed frame (no page gutter) so a 390px screenshot lines up with design/screenshots. */
export const PreviewFrame = ({ mockup, children }: PreviewFrameProps) => (
	<div className="flex flex-col gap-2">
		<Text as="span" variant="eyebrow" tone="muted">
			{mockup}
		</Text>
		<section data-preview={mockup} className="-mx-gutter flex flex-col bg-app pb-4">
			{children}
		</section>
	</div>
)
