import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { NEW_RECIPE_ENTRY_STATE } from '@/features/send-message'
import { ROUTES } from '@/shared/config'
import { cn } from '@/shared/lib'
import { Heading, Icon, ICON_SIZE, iconButtonVariants } from '@/shared/ui'

/** mockups/recipes.html header: «Рецепти» and the round «+» that leads to the chat (the recipe is made there). */
export const RecipesHeader = () => {
	const { t } = useTranslation()

	return (
		<header className="flex items-center justify-between px-5 pt-5.5 pb-3">
			<Heading as="h1">{t('recipes.title')}</Heading>
			<Link
				to={ROUTES.chat}
				state={NEW_RECIPE_ENTRY_STATE}
				aria-label={t('recipes.newRecipe')}
				className={cn(
					iconButtonVariants({ variant: 'primary' }),
					'shadow-accent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ink',
				)}
			>
				<Icon name="plus" size={ICON_SIZE.control} />
			</Link>
		</header>
	)
}
