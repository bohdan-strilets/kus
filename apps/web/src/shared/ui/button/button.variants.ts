import { cva, type VariantProps } from 'class-variance-authority'

/**
 * design/docs/components.md → Button, sizes and weights from the mockups:
 * lg 48 (auth, sheets, dialog), md 40 («Спробувати ще», chat-error), sm 34 («Редагувати»).
 * md and sm keep their look but get a ≥ 44px tap area through an invisible ::after
 * (CLAUDE.md §13). Label and loader share one grid cell, so the height never jumps.
 */
export const buttonVariants = cva(
	'relative inline-grid cursor-pointer place-items-center select-none *:col-start-1 *:row-start-1 disabled:cursor-not-allowed aria-disabled:cursor-not-allowed',
	{
		variants: {
			variant: {
				primary: 'bg-primary font-bold text-white',
				secondary: 'bg-secondary font-semibold text-ink',
				dark: 'bg-ink font-bold text-white',
				danger: 'bg-danger font-bold text-white',
				/** a link on a white card: primary 700, underlined («Спершу експортувати дані») */
				text: 'bg-transparent font-bold text-primary underline underline-offset-2',
				/** a link on the screen gradient: primary is 4.20:1 on bg-app, so primary-deep */
				textOnBackground: 'bg-transparent font-bold text-primary-deep underline underline-offset-2',
				/** «Вийти з акаунту»: danger 14/600, no underline */
				textDanger: 'bg-transparent font-semibold text-danger',
				/** «Вийти» on account-restore: a quiet 15/600 action, no underline */
				textPlain: 'bg-transparent font-semibold text-muted-strong',
			},
			size: {
				lg: 'min-h-button rounded-button px-5 text-body',
				md: 'min-h-10 rounded-full px-4 text-card-title after:absolute after:inset-x-0 after:-inset-y-0.5',
				sm: 'min-h-8.5 rounded-full px-3.5 text-caption after:absolute after:inset-x-0 after:-inset-y-1.25',
			},
			isFullWidth: {
				true: 'w-full',
				false: '',
			},
		},
		compoundVariants: [
			// «Перерахувати цілі» in profile: 14/700
			{ variant: 'dark', size: 'lg', className: 'text-card-title' },
			// text buttons: 44 tall, no fill, 14px (docs: text 44); sm is 13px («Забув пароль?»)
			{
				variant: ['text', 'textOnBackground', 'textDanger'],
				className: 'min-h-tap px-4 text-card-title',
			},
			{ variant: 'textPlain', className: 'min-h-tap px-4 text-body' },
			{
				variant: ['text', 'textOnBackground', 'textDanger'],
				size: 'sm',
				className: 'text-caption',
			},
		],
		defaultVariants: { variant: 'primary', size: 'lg', isFullWidth: false },
	},
)

export type ButtonVariantProps = VariantProps<typeof buttonVariants>
