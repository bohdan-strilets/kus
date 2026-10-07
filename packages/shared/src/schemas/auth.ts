import { z } from 'zod'

import { localeSchema } from './enums.js'

export const PASSWORD_MIN_LENGTH = 10
/** argon2 hashes the whole input, so an unbounded password is a cheap way to burn server CPU. */
export const PASSWORD_MAX_LENGTH = 128
export const EMAIL_MAX_LENGTH = 254
export const USER_NAME_MAX_LENGTH = 60

/** Emails are stored lowercased (DB check constraint), so every input is normalized the same way. */
export const emailSchema = z.string().trim().toLowerCase().max(EMAIL_MAX_LENGTH).pipe(z.email())

export const registerRequestSchema = z.object({
	email: emailSchema,
	password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
	name: z.string().trim().min(1).max(USER_NAME_MAX_LENGTH),
	/** Consent to processing food and weight data (RODO); the server stores when it was given. */
	consent: z.literal(true),
})

export type RegisterRequest = z.infer<typeof registerRequestSchema>

/** No min length on login: the policy is enforced at registration and must not leak here. */
export const loginRequestSchema = z.object({
	email: emailSchema,
	password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
})

export type LoginRequest = z.infer<typeof loginRequestSchema>

/** The current user as the web app sees it: never credentials, lockout state or sessions. */
export const authUserSchema = z.object({
	id: z.uuid(),
	email: z.email(),
	name: z.string().nullable(),
	locale: localeSchema,
	timezone: z.string(),
	createdAt: z.iso.datetime(),
})

export type AuthUser = z.infer<typeof authUserSchema>

/** Body of POST /auth/register and POST /auth/login. */
export const authSessionResponseSchema = z.object({
	user: authUserSchema,
})

export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>
