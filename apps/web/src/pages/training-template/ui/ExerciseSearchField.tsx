import { PROGRAM_NAME_MAX_LENGTH } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import { Icon, ICON_SIZE, IconButton, Input } from '@/shared/ui'

interface ExerciseSearchFieldProps {
	value: string
	onChange: (value: string) => void
}

/** The 48px field of «Вправа» (mockups/training-program.html): 16px text, a primary ring on focus, a 44px «×» that clears. */
export const ExerciseSearchField = ({ value, onChange }: ExerciseSearchFieldProps) => {
	const { t } = useTranslation()
	const label = t('program.editor.search.label')

	return (
		<div className="flex min-h-button items-center gap-2 rounded-button border-2 border-transparent bg-field pr-1.5 pl-3.5 focus-within:border-primary">
			<Icon name="search" size={ICON_SIZE.control} className="shrink-0 text-muted" />
			<Input
				type="text"
				inputMode="search"
				enterKeyHint="search"
				autoComplete="off"
				maxLength={PROGRAM_NAME_MAX_LENGTH}
				aria-label={label}
				placeholder={label}
				value={value}
				onChange={(event) => {
					onChange(event.target.value)
				}}
			/>
			{value !== '' && (
				<IconButton
					label={t('program.editor.search.clear')}
					variant="ghost"
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
