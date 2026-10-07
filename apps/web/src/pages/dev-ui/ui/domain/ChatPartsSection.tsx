import { ArrowClockwiseIcon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

import { EntryCard, EntryItem } from '@/entities/entry'
import { KusikRow, MessageBubble, TimeDivider, TypingIndicator } from '@/entities/message'
import { RecipeSuggestion } from '@/entities/recipe'
import { Button, Text } from '@/shared/ui'

import { SEED_BREAKFAST, SEED_CHAT_TIMES, SEED_RECIPE } from '../../model/seed'
import { useSeedEntries } from '../../model/use-seed-entries'
import { DevSection } from '../DevSection'
import { BreakfastCard } from './BreakfastCard'

const RETRY_ICON_SIZE = 16

export const ChatPartsSection = () => {
	const { t } = useTranslation()
	const { buckwheat, coffee, unknown } = useSeedEntries()

	return (
		<DevSection title={t('devUi.sections.chatParts')}>
			<div className="flex flex-col gap-2.5">
				<MessageBubble author="user">{t('devUi.seed.userBreakfast')}</MessageBubble>
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
				<TypingIndicator />
				<TimeDivider time={SEED_CHAT_TIMES.failedLunch} />
				<MessageBubble author="user" isFailed>
					{t('devUi.seed.userLunchFailed')}
				</MessageBubble>
				<KusikRow kind="error">
					<MessageBubble tone="error">
						<Text>{t('devUi.seed.kusikError')}</Text>
						<Button
							size="md"
							className="self-start"
							icon={<ArrowClockwiseIcon aria-hidden size={RETRY_ICON_SIZE} weight="bold" />}
						>
							{t('chat.retry')}
						</Button>
					</MessageBubble>
				</KusikRow>
			</div>

			<KusikRow kind="clarify">
				<BreakfastCard isClarifyOpen />
			</KusikRow>

			<KusikRow>
				<EntryCard
					mealLabel={t('meal.snack')}
					time="16:30"
					kcal={buckwheat.kcal + coffee.kcal + unknown.kcal}
					macros={SEED_BREAKFAST.macros}
				>
					<EntryItem entry={{ ...buckwheat, captionState: 'plain' }} />
					<EntryItem entry={coffee} />
					<EntryItem entry={unknown} />
				</EntryCard>
			</KusikRow>
		</DevSection>
	)
}
