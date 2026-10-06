import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge only knows Tailwind's default scale; without this it reads `text-big-number`
 * as a colour and drops it next to `text-ink`. Names mirror shared/ui/theme/tokens.css.
 */
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			text: [
				'screen-title',
				'big-number',
				'title',
				'input',
				'body',
				'card-title',
				'caption',
				'small',
				'wordmark',
			],
			radius: [
				'screen',
				'sheet',
				'card',
				'panel',
				'nav',
				'bubble',
				'bubble-ai',
				'tail',
				'tile',
				'tile-sm',
				'field',
				'chip',
				'icon',
				'button',
				'badge',
			],
			shadow: ['card', 'chip', 'accent', 'sheet', 'float', 'field', 'dialog'],
			spacing: ['gutter', 'tap', 'button', 'safe-top', 'safe-bottom'],
		},
		classGroups: {
			// gradient utilities from tokens.css are background images, not background colours
			'bg-image': ['bg-app', 'bg-soft-card', 'bg-dark-card'],
		},
	},
})

/** Joins conditional class names and resolves Tailwind conflicts (last one wins). */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs))
