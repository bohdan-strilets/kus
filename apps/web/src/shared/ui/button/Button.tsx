import { type HTMLMotionProps, motion } from 'motion/react'
import type { MouseEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn, PRESS, useDelayedFlag } from '@/shared/lib'

import { Loader } from '../brand'
import { BUTTON_LOADER_SIZE, LOADER_TONE_BY_VARIANT } from './button.constants'
import { type ButtonVariantProps, buttonVariants } from './button.variants'

export type ButtonProps = ButtonVariantProps &
	Omit<HTMLMotionProps<'button'>, 'children'> & {
		children: ReactNode
		/** Leading icon, e.g. <Icon name="retry" size={ICON_SIZE.control} />. */
		icon?: ReactNode
		/** Blocks clicks at once; the loader and loadingText appear only after 300 ms (CLAUDE.md §12). */
		isLoading?: boolean
		/** What is happening while loading, e.g. «Зберігаю…». Defaults to the label. */
		loadingText?: string
	}

export const Button = ({
	variant,
	size,
	isFullWidth,
	icon,
	isLoading = false,
	loadingText,
	disabled,
	type = 'button',
	onClick,
	className,
	children,
	...props
}: ButtonProps) => {
	const { t } = useTranslation()
	const isLoaderShown = useDelayedFlag(isLoading)
	const isInactive = Boolean(disabled) || isLoading

	// while loading the button stays focusable (aria-disabled, not disabled), so keyboard and
	// VoiceOver users don't lose their place; the click is swallowed here instead
	const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
		if (isLoading) {
			event.preventDefault()
			return
		}
		onClick?.(event)
	}

	return (
		<motion.button
			type={type}
			disabled={disabled}
			aria-disabled={isLoading || undefined}
			aria-busy={isLoading || undefined}
			onClick={handleClick}
			className={cn(
				buttonVariants({ variant, size, isFullWidth }),
				disabled && 'opacity-50',
				className,
			)}
			{...(isInactive ? {} : PRESS)}
			{...props}
		>
			<span className={cn('flex items-center gap-1.5', isLoaderShown && 'invisible')}>
				{icon}
				{children}
			</span>
			{isLoaderShown && (
				<span className="flex items-center gap-2">
					{/* the visible text names the action; the spinner itself stays silent */}
					<span aria-hidden="true" className="flex">
						<Loader
							size={BUTTON_LOADER_SIZE}
							tone={LOADER_TONE_BY_VARIANT[variant ?? 'primary']}
							ariaLabel={t('common.loading')}
						/>
					</span>
					{loadingText ?? children}
				</span>
			)}
		</motion.button>
	)
}
