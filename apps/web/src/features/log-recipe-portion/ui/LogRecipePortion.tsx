import type { RecipeDetail, RecipePortionShare } from '@kus/shared'
import * as RadioGroup from '@radix-ui/react-radio-group'
import { type ReactNode, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatInteger } from '@/shared/lib'
import { Button, Chip } from '@/shared/ui'

import { useLogRecipePortion } from '../model/use-log-recipe-portion'

const DEFAULT_SHARE: RecipePortionShare = 1

const SHARE_LABEL_KEYS = {
	0.5: 'recipes.detail.share.half',
	1: 'recipes.detail.share.one',
	1.5: 'recipes.detail.share.oneAndHalf',
} as const

export interface LogRecipePortionProps {
	recipe: Pick<RecipeDetail, 'id' | 'portions'>
	/** A page-level action shown at the end of the same card («Змінити склад у чаті»). */
	children?: ReactNode
}

/** mockups/recipe-detail.html: «Порція» ½ / 1 / 1½ with the kcal of each and «Додати на сьогодні». */
export const LogRecipePortion = ({ recipe, children }: LogRecipePortionProps) => {
	const { t } = useTranslation()
	const { log, isPending } = useLogRecipePortion()
	const [share, setShare] = useState<RecipePortionShare>(DEFAULT_SHARE)

	return (
		<div className="flex flex-col gap-3">
			<RadioGroup.Root
				value={String(share)}
				onValueChange={(next) => {
					const picked = recipe.portions.find((portion) => String(portion.share) === next)
					if (picked) setShare(picked.share)
				}}
				aria-label={t('recipes.detail.portionGroup')}
				className="flex gap-2"
			>
				{recipe.portions.map((portion) => (
					<RadioGroup.Item key={portion.share} value={String(portion.share)} asChild>
						<Chip
							variant="choice"
							isSelected={portion.share === share}
							// a radio is announced by its checked state, not as a toggle button
							aria-pressed={undefined}
							className="flex-1"
						>
							{t(SHARE_LABEL_KEYS[portion.share], { kcal: formatInteger(portion.kcal) })}
						</Chip>
					</RadioGroup.Item>
				))}
			</RadioGroup.Root>
			<Button
				isFullWidth
				isLoading={isPending}
				onClick={() => {
					log({ id: recipe.id, share })
				}}
			>
				{t('recipes.detail.addToday')}
			</Button>
			{children && <div className="flex justify-center">{children}</div>}
		</div>
	)
}
