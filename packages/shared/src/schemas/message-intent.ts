import { z } from 'zod'

/** Where in the app a message was started from; the model gets it as a line of the context. */
export const MESSAGE_INTENTS = ['new_recipe'] as const

export const messageIntentSchema = z.enum(MESSAGE_INTENTS)

export type MessageIntent = z.infer<typeof messageIntentSchema>
