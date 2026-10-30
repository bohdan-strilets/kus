import { useTranslation } from 'react-i18next'

import { Icon, ICON_SIZE, IconButton, Input } from '@/shared/ui'

interface ProductSearchProps {
	value: string
	onChange: (value: string) => void
}

/** mockups/memory-products.html «Пошук»: a 48px field, 16px text (iOS does not zoom), a 44px «×» that clears. */
export const ProductSearch = ({ value, onChange }: ProductSearchProps) => {
	const { t } = useTranslation()
	const label = t('memory.products.search.label')

	return (
		<div className="flex min-h-button items-center gap-2 rounded-field bg-surface pr-1 pl-3.5 shadow-field focus-within:ring-2 focus-within:ring-primary focus-within:ring-inset">
			<Icon name="search" size={ICON_SIZE.control} className="shrink-0 text-muted" />
			<Input
				type="text"
				inputMode="search"
				enterKeyHint="search"
				autoComplete="off"
				aria-label={label}
				placeholder={label}
				value={value}
				onChange={(event) => {
					onChange(event.target.value)
				}}
			/>
			{value !== '' && (
				<IconButton
					label={t('memory.products.search.clear')}
					onClick={() => {
						onChange('')
					}}
				>
					<Icon name="close" size={ICON_SIZE.control} />
				</IconButton>
			)}
		</div>
	)
}
