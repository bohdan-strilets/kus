import type { RecipeListItem } from '@kus/shared'

import { RecipeCard } from '@/entities/recipe'
import { getRecipePath } from '@/shared/config'

import { CreateRecipeTile } from './CreateRecipeTile'

/** mockups/recipes.html: two columns of recipe cards, the «Опиши страву в чаті» tile at the end. */
export const RecipesGrid = ({ recipes }: { recipes: readonly RecipeListItem[] }) => (
	<ul className="mt-3 grid grid-cols-2 gap-2.5 px-gutter pb-2">
		{recipes.map((recipe) => (
			<li key={recipe.id} className="flex flex-col">
				<RecipeCard recipe={recipe} to={getRecipePath(recipe.id)} />
			</li>
		))}
		<li className="flex">
			<CreateRecipeTile />
		</li>
	</ul>
)
