import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { ROUTES } from '@/shared/config'
import { HamsterHead, Surface, Text } from '@/shared/ui'

const HAMSTER_SIZE = 52

/** mockups/recipes.html: the dashed tile with the hamster; a recipe is described in the chat. */
export const CreateRecipeTile = () => {
	const { t } = useTranslation()

	return (
		<Surface
			variant="dashed"
			radius="card"
			className="flex min-h-37.5 flex-1 has-focus-visible:outline-3 has-focus-visible:outline-ink"
		>
			<Link
				to={ROUTES.chat}
				className="flex flex-1 flex-col items-center justify-center gap-2 p-2.5 text-center focus-visible:outline-none"
			>
				<HamsterHead size={HAMSTER_SIZE} />
				<Text as="span" variant="caption" weight="bold" className="leading-snug">
					{t('recipes.createTile.title')}
				</Text>
				<Text as="span" variant="small" weight="regular" tone="muted">
					{t('recipes.createTile.hint')}
				</Text>
			</Link>
		</Surface>
	)
}
