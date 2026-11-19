import { type MessageIntent, messageIntentSchema } from '@kus/shared'
import { z } from 'zod'

const chatEntryStateSchema = z.object({ intent: messageIntentSchema })

/** `state` of a navigation to the chat that opens «Новий рецепт» (design/mockups/chat-new-recipe.html). */
export const NEW_RECIPE_ENTRY_STATE: { intent: MessageIntent } = { intent: 'new_recipe' }

/** location.state can come from history, so it is untrusted: anything unknown is the plain chat. */
export const getChatEntryIntent = (state: unknown): MessageIntent | null => {
	const parsed = chatEntryStateSchema.safeParse(state)
	return parsed.success ? parsed.data.intent : null
}
