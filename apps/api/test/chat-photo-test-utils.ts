import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	authSessionResponseSchema,
	createDataResponseSchema,
	uploadPhotoResponseSchema,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { expect } from 'vitest'

import { createJpeg, toBase64 } from './fixtures/jpeg'

export const MESSAGES_URL = '/api/v1/messages'
export const PHOTOS_URL = '/api/v1/photos'
export const FULL_WIDTH = 1200
export const FULL_HEIGHT = 900
const THUMB_WIDTH = 768
const THUMB_HEIGHT = 576
const DATA_URL_PREFIX = 'data:image/jpeg;base64,'

export interface TestUser {
	agent: TestAgent
	userId: string
}

export const registerUser = async (
	app: NestExpressApplication,
	email: string,
): Promise<TestUser> => {
	const agent = request.agent(app.getHttpServer())
	const response = await agent
		.post('/api/v1/auth/register')
		.send({ email, password: 'correct-horse-battery', name: 'Test', consent: true })
		.expect(201)
	const { user } = createDataResponseSchema(authSessionResponseSchema).parse(response.body).data
	return { agent, userId: user.id }
}

/** A distinct full photo per `variant`, so two uploads never share bytes. */
export const createFullJpeg = (variant = 0): Buffer =>
	createJpeg({ width: FULL_WIDTH + variant, height: FULL_HEIGHT })

export const createUploadBody = (full: Buffer = createFullJpeg()) => ({
	photo: { mimeType: 'image/jpeg', data: toBase64(full) },
	thumb: {
		mimeType: 'image/jpeg',
		data: toBase64(createJpeg({ width: THUMB_WIDTH, height: THUMB_HEIGHT })),
	},
	width: FULL_WIDTH,
	height: FULL_HEIGHT,
})

/** POST /photos; the id of the stored photo. */
export const uploadPhoto = async (
	user: TestUser,
	full: Buffer = createFullJpeg(),
): Promise<string> => {
	const response = await user.agent.post(PHOTOS_URL).send(createUploadBody(full)).expect(201)
	return createDataResponseSchema(uploadPhotoResponseSchema).parse(response.body).data.id
}

/** The user turn of a recorded model request: what the model actually got. */
export const getUserContent = (body: unknown): unknown => {
	const messages = (body as { messages: { role: string; content: unknown }[] }).messages
	return messages.findLast((message) => message.role === 'user')?.content
}

/** The image bytes a recorded model request carried, decoded from its data URL. */
export const getSentImageBytes = (body: unknown): Buffer => {
	const content = getUserContent(body) as { type: string; image_url?: { url: string } }[]
	const url = content.find((part) => part.type === 'image_url')?.image_url?.url ?? ''
	expect(url.startsWith(DATA_URL_PREFIX)).toBe(true)
	return Buffer.from(url.slice(DATA_URL_PREFIX.length), 'base64')
}
