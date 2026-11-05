import { cva } from 'class-variance-authority'

/** mockups/chat-rich-text.html: 10px between blocks, tight lists, 15/800 headings. */
export const RICH_BLOCKS_CLASS = 'flex flex-col gap-2.5'

export const RICH_HEADING_CLASS = 'my-0.5 text-body font-extrabold text-ink'

export const RICH_LIST_CLASS = 'm-0 flex list-none flex-col gap-1 p-0'

export const RICH_STRONG_CLASS = 'font-bold'

export const richMarkerVariants = cva('flex-none', {
	variants: {
		marker: {
			/** number column 22, 700 muted-strong */
			number: 'w-5.5 font-bold text-muted-strong tabular-nums',
			/** dot column 16, a 5px primary dot centred on the first line */
			dot: 'flex w-4 items-start pt-2',
		},
	},
})

export const RICH_DOT_CLASS = 'size-1.25 rounded-full bg-primary'
