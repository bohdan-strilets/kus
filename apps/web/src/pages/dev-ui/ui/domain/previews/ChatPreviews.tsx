import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { KusikRow, MessageBubble, TimeDivider } from '@/entities/message'
import { RecipeSuggestion } from '@/entities/recipe'
import { DaySummaryCard } from '@/entities/stats'
import { Composer } from '@/features/send-message'
import { Chip, Text } from '@/shared/ui'

import {
	SEED_CHAT_TIMES,
	SEED_EATEN_KCAL,
	SEED_GOAL_KCAL,
	SEED_MACROS,
	SEED_RECIPE,
} from '../../../model/seed'
import { BreakfastCard } from '../BreakfastCard'
import { ChatPreviewHeader } from '../PreviewHeaders'
import { PreviewFrame } from './PreviewFrame'

const QUICK_CHIP_KEYS = [
	'devUi.level0.weekSummary',
	'devUi.level0.addWeight',
	'devUi.level0.myRecipes',
] as const

const ChatBottom = ({ initialMessage = '' }: { initialMessage?: string }) => {
	const { t } = useTranslation()
	const [message, setMessage] = useState(initialMessage)
	const isLong = initialMessage.length > 0

	return (
		<>
			{!isLong && (
				<div className="scrollbar-none flex gap-2 overflow-x-auto px-gutter pt-0.5 pb-2.5">
					{QUICK_CHIP_KEYS.map((key) => (
						<Chip key={key}>{t(key)}</Chip>
					))}
				</div>
			)}
			<div className="px-gutter">
				<Composer value={message} onValueChange={setMessage} onSubmit={() => undefined} />
			</div>
		</>
	)
}

const ChatTop = () => (
	<>
		<ChatPreviewHeader />
		<div className="px-gutter">
			<DaySummaryCard eaten={SEED_EATEN_KCAL} goal={SEED_GOAL_KCAL} macros={SEED_MACROS} />
		</div>
	</>
)

/** chat, chat-clarify and chat-long-input assembled from the real components and seed data. */
export const ChatPreviews = () => {
	const { t } = useTranslation()

	return (
		<>
			<PreviewFrame mockup="chat">
				<ChatTop />
				<div className="flex flex-col gap-2.5 px-gutter pt-3.5 pb-2.5">
					<KusikRow kind="mealLogged">
						<BreakfastCard />
					</KusikRow>
					<TimeDivider time={SEED_CHAT_TIMES.dinnerQuestion} />
					<MessageBubble author="user">{t('devUi.seed.userDinner')}</MessageBubble>
					<KusikRow kind="suggestion">
						<MessageBubble>
							<Text>{t('devUi.seed.kusikTip')}</Text>
							<RecipeSuggestion
								name={t('devUi.seed.recipeName')}
								kcal={SEED_RECIPE.kcal}
								proteinGrams={SEED_RECIPE.proteinGrams}
								mealLabel={t('meal.dinner')}
								icon="chickenBuckwheat"
							/>
						</MessageBubble>
					</KusikRow>
				</div>
				<ChatBottom />
			</PreviewFrame>

			<PreviewFrame mockup="chat-clarify">
				<ChatTop />
				<div className="flex flex-col gap-2.5 px-gutter pt-3.5 pb-2.5">
					<MessageBubble author="user">{t('devUi.seed.userBreakfast')}</MessageBubble>
					<KusikRow kind="clarify">
						<BreakfastCard isClarifyOpen />
					</KusikRow>
				</div>
				<ChatBottom />
			</PreviewFrame>

			<PreviewFrame mockup="chat-long-input">
				<ChatTop />
				<div className="flex flex-col gap-2.5 px-gutter pt-3.5 pb-2.5">
					<MessageBubble author="user">{t('devUi.seed.userBreakfast')}</MessageBubble>
					<KusikRow kind="mealLogged">
						<BreakfastCard />
					</KusikRow>
				</div>
				<ChatBottom initialMessage={t('devUi.seed.longMessage')} />
			</PreviewFrame>
		</>
	)
}
