import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { ROUTES } from '@/shared/config'
import { Button, Hamster, Heading, Text } from '@/shared/ui'

const HAMSTER_SIZE = 140

/** mockups/recipes-empty.html: what will live here and the way to the chat, where a recipe is made. */
export const RecipesEmpty = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-8 text-center">
			<Hamster mood="hungry" size={HAMSTER_SIZE} />
			<Heading as="h2" level="title">
				{t('recipes.empty.title')}
			</Heading>
			<Text tone="mutedStrong">{t('recipes.empty.text')}</Text>
			<Button onClick={() => void navigate(ROUTES.chat)}>{t('recipes.empty.action')}</Button>
		</div>
	)
}
