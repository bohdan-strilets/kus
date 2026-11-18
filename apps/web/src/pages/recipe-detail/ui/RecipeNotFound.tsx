import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { ROUTES } from '@/shared/config'
import { Button, Hamster, Heading } from '@/shared/ui'

const HAMSTER_SIZE = 120

/** No mockup: the empty-state pattern of the app. The recipe is gone, deleted or never was. */
export const RecipeNotFound = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()

	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-8 text-center">
			<Hamster mood="oops" size={HAMSTER_SIZE} />
			<Heading as="h2" level="title">
				{t('recipes.notFound.title')}
			</Heading>
			<Button
				onClick={() => {
					void navigate(ROUTES.recipes, { replace: true })
				}}
			>
				{t('recipes.notFound.action')}
			</Button>
		</div>
	)
}
