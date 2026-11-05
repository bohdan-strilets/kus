import { Fragment, type ReactNode } from 'react'
import { parseRichText, type RichBlock, type RichInline } from '@kus/shared'

import { cn } from '@/shared/lib'
import { Text } from '@/shared/ui'

import {
	RICH_BLOCKS_CLASS,
	RICH_DOT_CLASS,
	RICH_HEADING_CLASS,
	RICH_LIST_CLASS,
	RICH_STRONG_CLASS,
	richMarkerVariants,
} from './rich-text.variants'

export interface RichTextProps {
	/** The model's text; only React nodes come out, never HTML. */
	text: string
	/** `inline`: only bold, lines and blocks glued by a space (notes inside cards). */
	variant?: 'block' | 'inline'
	className?: string
}

const renderInlines = (inlines: RichInline[]): ReactNode =>
	inlines.map((inline, index) =>
		inline.type === 'strong' ? (
			<strong key={index} className={RICH_STRONG_CLASS}>
				{inline.text}
			</strong>
		) : (
			<Fragment key={index}>{inline.text}</Fragment>
		),
	)

const renderParagraph = (lines: RichInline[][]): ReactNode =>
	lines.map((line, index) => (
		<Fragment key={index}>
			{index > 0 && <br />}
			{renderInlines(line)}
		</Fragment>
	))

const renderList = (block: Extract<RichBlock, { type: 'list' }>): ReactNode => {
	const ListTag = block.ordered ? 'ol' : 'ul'
	return (
		<ListTag role="list" className={cn(RICH_LIST_CLASS, 'text-body text-ink')}>
			{block.items.map((item, index) => (
				<li key={index} className="flex gap-0.5">
					<span
						aria-hidden="true"
						className={richMarkerVariants({ marker: block.ordered ? 'number' : 'dot' })}
					>
						{block.ordered ? `${block.start + index}.` : <span className={RICH_DOT_CLASS} />}
					</span>
					<span className="min-w-0 flex-1">{renderInlines(item)}</span>
				</li>
			))}
		</ListTag>
	)
}

const renderBlock = (block: RichBlock, index: number): ReactNode => {
	if (block.type === 'heading') {
		return (
			<p key={index} className={RICH_HEADING_CLASS}>
				{renderInlines(block.content)}
			</p>
		)
	}
	if (block.type === 'list') return <Fragment key={index}>{renderList(block)}</Fragment>
	return <Text key={index}>{renderParagraph(block.lines)}</Text>
}

const renderFlat = (blocks: RichBlock[]): ReactNode => {
	const groups: RichInline[][] = blocks.flatMap((block) => {
		if (block.type === 'paragraph') return block.lines
		if (block.type === 'heading') return [block.content]
		return block.items
	})
	return groups.map((group, index) => (
		<Fragment key={index}>
			{index > 0 && ' '}
			{renderInlines(group)}
		</Fragment>
	))
}

/** Kusik's reply text: paragraphs, a short heading, lists and bold (plan 0.10.5, 2.1). */
export const RichText = ({ text, variant = 'block', className }: RichTextProps) => {
	const blocks = parseRichText(text)
	if (variant === 'inline') return <>{renderFlat(blocks)}</>
	return <div className={cn(RICH_BLOCKS_CLASS, className)}>{blocks.map(renderBlock)}</div>
}
