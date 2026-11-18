import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui'

import { useDeleteRecipe } from '../model/use-delete-recipe'

export interface DeleteRecipeButtonProps {
	recipeId: string
	/** Called after the recipe is deleted; the page leads back to the list. */
	onDeleted: () => void
}

/** mockups/recipe-detail.html: the quiet danger text button under the actions. */
export const DeleteRecipeButton = ({ recipeId, onDeleted }: DeleteRecipeButtonProps) => {
	const { t } = useTranslation()
	const { remove, isPending } = useDeleteRecipe({ onDeleted })

	return (
		<Button
			variant="textDanger"
			size="md"
			isLoading={isPending}
			onClick={() => {
				remove(recipeId)
			}}
		>
			{t('recipes.detail.delete')}
		</Button>
	)
}
