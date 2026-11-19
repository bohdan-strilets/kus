import { useTranslation } from 'react-i18next'

import { KusikRow, MessageBubble } from '@/entities/message'
import { Text } from '@/shared/ui'

/**
 * mockups/chat-new-recipe.html: the pill «Новий рецепт» and Kusik's explanation with an example,
 * at the end of the feed until the first message of this state is sent.
 */
export const NewRecipeIntro = () => {
	const { t } = useTranslation()

	return (
		<div className="flex flex-col gap-2.5">
			<Text
				as="span"
				variant="small"
				weight="bold"
				tone="primaryDeep"
				className="self-center rounded-badge bg-surface/75 px-3 py-0.75"
			>
				{t('chat.newRecipe.label')}
			</Text>
			<KusikRow>
				<MessageBubble>
					<Text className="leading-normal">{t('chat.newRecipe.intro')}</Text>
					<Text
						variant="caption"
						weight="regular"
						tone="mutedStrong"
						className="rounded-tile-sm bg-field px-3 py-2.5 leading-normal"
					>
						{t('chat.newRecipe.example')}
					</Text>
				</MessageBubble>
			</KusikRow>
		</div>
	)
}
