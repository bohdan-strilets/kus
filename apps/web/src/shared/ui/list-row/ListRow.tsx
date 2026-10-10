import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Icon } from '../icon'
import { Text } from '../text'
import { CHEVRON_SIZE } from './list-row.constants'
import { type ListRowVariantProps, listRowVariants } from './list-row.variants'

export type ListRowProps = Pick<ListRowVariantProps, 'size'> & {
	label: string
	/** Muted 14px text on the right, e.g. «Чоловік». */
	value?: ReactNode
	/** Before the label, e.g. <ListRowIcon />. */
	leading?: ReactNode
	/** Replaces the chevron, e.g. a <Switch />. */
	trailing?: ReactNode
	/** Default: shown for a link or a button, hidden for a static row. */
	hasChevron?: boolean
	tone?: 'ink' | 'danger'
	/** A link to another screen. */
	to?: string
	/** A button, e.g. one that opens an edit sheet. */
	onClick?: () => void
	/** Set for a button that opens a sheet or dialog. */
	hasPopup?: boolean
}

/** One row of a RowGroup: a link (`to`), a button (`onClick`) or a static div. */
export const ListRow = ({
	label,
	value,
	leading,
	trailing,
	hasChevron,
	tone = 'ink',
	size,
	to,
	onClick,
	hasPopup = false,
}: ListRowProps) => {
	const isInteractive = to !== undefined || onClick !== undefined
	const className = listRowVariants({ size, isInteractive })
	const isChevronShown = trailing === undefined && (hasChevron ?? isInteractive)

	const content = (
		<>
			{leading}
			<Text
				as="span"
				variant="body"
				weight="semibold"
				tone={tone === 'danger' ? 'danger' : 'ink'}
				className="min-w-0 flex-1 truncate"
			>
				{label}
			</Text>
			{value !== undefined && (
				<Text as="span" variant="cardTitle" weight="regular" tone="muted" className="text-right">
					{value}
				</Text>
			)}
			{trailing}
			{isChevronShown && <Icon name="chevron-right" size={CHEVRON_SIZE} className="text-muted" />}
		</>
	)

	if (to !== undefined) {
		return (
			<Link to={to} className={className}>
				{content}
			</Link>
		)
	}
	if (onClick !== undefined) {
		return (
			<button
				type="button"
				onClick={onClick}
				aria-haspopup={hasPopup ? 'dialog' : undefined}
				className={className}
			>
				{content}
			</button>
		)
	}
	return <div className={className}>{content}</div>
}
