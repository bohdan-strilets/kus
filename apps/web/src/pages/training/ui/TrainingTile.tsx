import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { cn } from '@/shared/lib'
import { Icon, type IconName, Surface, Text } from '@/shared/ui'

const TILE_ICON_SIZE = 20

const TILE_CLASS_NAME =
	'flex min-h-16 w-full items-center gap-2.5 rounded-chip px-3 py-2.5 text-left text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink'

type TrainingTileProps = {
	icon: IconName
	title: string
	/** Muted second line; the tile keeps its height without it. */
	subtitle?: ReactNode
} & ({ to: string; onClick?: never } | { onClick: () => void; to?: never })

/** A half-width tile of the tab (mockups/training-home.html «Статистика», «Програма»): a link or a button. */
export const TrainingTile = ({ icon, title, subtitle, to, onClick }: TrainingTileProps) => {
	const content = (
		<>
			<span
				aria-hidden="true"
				className="flex size-9 flex-none items-center justify-center rounded-icon bg-hint-training-bg text-hint-training-ink"
			>
				<Icon name={icon} size={TILE_ICON_SIZE} />
			</span>
			<span className="flex min-w-0 flex-col">
				<Text as="span" variant="cardTitle" weight="bold" className="truncate">
					{title}
				</Text>
				{subtitle && (
					<Text as="span" variant="small" tone="muted" className="truncate">
						{subtitle}
					</Text>
				)}
			</span>
		</>
	)

	return (
		<Surface variant="list" radius="chip" shadow="list" className="min-w-0 flex-1">
			{to === undefined ? (
				<button type="button" onClick={onClick} className={cn(TILE_CLASS_NAME, 'cursor-pointer')}>
					{content}
				</button>
			) : (
				<Link to={to} className={TILE_CLASS_NAME}>
					{content}
				</Link>
			)}
		</Surface>
	)
}
