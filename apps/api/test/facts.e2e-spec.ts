import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import {
	apiErrorResponseSchema,
	authSessionResponseSchema,
	createDataResponseSchema,
	factResponseSchema,
	FACTS_MAX,
	normalizeFactText,
} from '@kus/shared'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import type { FactCategory, FactStatus } from '../src/generated/prisma/client'
import { FactsCleanupService } from '../src/modules/facts/facts-cleanup.service'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const FACTS_URL = '/api/v1/facts'
const factUrl = (id: string): string => `${FACTS_URL}/${id}`
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000'
const MS_PER_DAY = 86_400_000

const factSchema = createDataResponseSchema(factResponseSchema)
const listSchema = createDataResponseSchema(factResponseSchema.array())

interface TestUser {
	agent: TestAgent
	userId: string
}

interface SeedFactOptions {
	category?: FactCategory
	status?: FactStatus
	deletedAt?: Date
	updatedAt?: Date
	createdAt?: Date
}

describe('facts (e2e, real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	const logSpies = [
		vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined),
		vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined),
	]

	const start = async (): Promise<void> => {
		;({ app, prisma } = await createDbTestApp())
	}

	const registerUser = async (email: string): Promise<TestUser> => {
		const agent = request.agent(app.getHttpServer())
		const response = await agent
			.post('/api/v1/auth/register')
			.send({ email, password: 'correct-horse-battery', name: 'Test', consent: true })
			.expect(201)
		const { user } = createDataResponseSchema(authSessionResponseSchema).parse(response.body).data
		return { agent, userId: user.id }
	}

	const seedFact = (user: TestUser, text: string, options: SeedFactOptions = {}) =>
		prisma.userFact.create({
			data: {
				userId: user.userId,
				text,
				textNormalized: normalizeFactText(text),
				category: options.category ?? 'FOOD',
				status: options.status ?? 'CONFIRMED',
				deletedAt: options.deletedAt,
				updatedAt: options.updatedAt,
				createdAt: options.createdAt,
			},
		})

	const seedConfirmed = async (user: TestUser, count: number): Promise<void> => {
		await prisma.userFact.createMany({
			data: Array.from({ length: count }, (_, index) => ({
				userId: user.userId,
				text: `Факт ${index}`,
				textNormalized: `факт ${index}`,
				category: 'OTHER' as const,
				status: 'CONFIRMED' as const,
			})),
		})
	}

	const expectError = (response: request.Response, errorCode: string): Record<string, unknown> => {
		const body = apiErrorResponseSchema.parse(response.body)
		expect(body.errorCode).toBe(errorCode)
		return body.details
	}

	const getFact = (id: string) => prisma.userFact.findUniqueOrThrow({ where: { id } })

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('answers 401 without a token', async () => {
		await start()
		const agent = request(app.getHttpServer())
		await agent.get(FACTS_URL).expect(401)
		await agent.patch(factUrl(UNKNOWN_ID)).send({ text: 'X' }).expect(401)
		await agent.delete(factUrl(UNKNOWN_ID)).expect(401)
		await agent.post(`${factUrl(UNKNOWN_ID)}/restore`).expect(401)
		await agent
			.post(`${factUrl(UNKNOWN_ID)}/answer`)
			.send({ accept: true })
			.expect(401)
	})

	describe('list', () => {
		it('returns only own active confirmed facts, by category then oldest first', async () => {
			await start()
			const user = await registerUser('facts-list@example.com')
			const other = await registerUser('facts-list-other@example.com')
			const base = Date.now() - 10 * MS_PER_DAY
			await seedFact(user, 'Тренуюсь у вівторок', {
				category: 'TRAINING',
				createdAt: new Date(base),
			})
			await seedFact(user, 'Друга їжа', { category: 'FOOD', createdAt: new Date(base + 2000) })
			await seedFact(user, 'Перша їжа', { category: 'FOOD', createdAt: new Date(base + 1000) })
			await seedFact(user, 'Пропозиція', { status: 'PROPOSED' })
			await seedFact(user, 'Відхилений', { status: 'REJECTED' })
			await seedFact(user, 'Видалений', { deletedAt: new Date() })
			await seedFact(other, 'Чужий факт')

			const response = await user.agent.get(FACTS_URL).expect(200)

			const texts = listSchema.parse(response.body).data.map((fact) => fact.text)
			expect(texts).toEqual(['Перша їжа', 'Друга їжа', 'Тренуюсь у вівторок'])
		})
	})

	describe('update', () => {
		it('edits the text and recomputes the normalized one', async () => {
			await start()
			const user = await registerUser('facts-patch@example.com')
			const fact = await seedFact(user, 'Не їм глютен')

			const response = await user.agent
				.patch(factUrl(fact.id))
				.send({ text: '  Не їм   Молочне ' })
				.expect(200)

			expect(factSchema.parse(response.body).data.text).toBe('Не їм Молочне')
			expect((await getFact(fact.id)).textNormalized).toBe('не їм молочне')
		})

		it('answers 422 HEALTH_DATA on the text field', async () => {
			await start()
			const user = await registerUser('facts-patch-guard@example.com')
			const fact = await seedFact(user, 'Не їм глютен')

			const response = await user.agent
				.patch(factUrl(fact.id))
				.send({ text: 'Маю діабет' })
				.expect(422)

			const details = expectError(response, 'VALIDATION_ERROR')
			expect(details).toMatchObject({ fields: { text: 'HEALTH_DATA' } })
			expect((await getFact(fact.id)).text).toBe('Не їм глютен')
		})

		it('answers 409 FACT_EXISTS when another fact has the text', async () => {
			await start()
			const user = await registerUser('facts-patch-exists@example.com')
			const first = await seedFact(user, 'Снідаю о восьмій')
			const second = await seedFact(user, 'Вечеряю вдома')

			const response = await user.agent
				.patch(factUrl(second.id))
				.send({ text: ' снідаю  О восьмій ' })
				.expect(409)

			expect(expectError(response, 'FACT_EXISTS')).toEqual({ existingId: first.id })
		})

		it('answers 404 for a foreign, a proposed, a deleted and an unknown fact', async () => {
			await start()
			const user = await registerUser('facts-patch-404@example.com')
			const other = await registerUser('facts-patch-404-other@example.com')
			const foreign = await seedFact(other, 'Чужий факт')
			const proposed = await seedFact(user, 'Пропозиція', { status: 'PROPOSED' })
			const deleted = await seedFact(user, 'Видалений', { deletedAt: new Date() })

			for (const id of [foreign.id, proposed.id, deleted.id, UNKNOWN_ID]) {
				const response = await user.agent.patch(factUrl(id)).send({ text: 'Новий' }).expect(404)
				expectError(response, 'FACT_NOT_FOUND')
			}
			expect((await getFact(foreign.id)).text).toBe('Чужий факт')
		})
	})

	describe('delete and restore', () => {
		it('soft deletes, answers 404 the second time and restores', async () => {
			await start()
			const user = await registerUser('facts-delete@example.com')
			const fact = await seedFact(user, 'Снідаю о восьмій')

			await user.agent.delete(factUrl(fact.id)).expect(204)
			expect((await getFact(fact.id)).deletedAt).not.toBeNull()
			expectError(await user.agent.delete(factUrl(fact.id)).expect(404), 'FACT_NOT_FOUND')

			const restored = await user.agent.post(`${factUrl(fact.id)}/restore`).expect(200)
			expect(factSchema.parse(restored.body).data.id).toBe(fact.id)
			expect((await getFact(fact.id)).deletedAt).toBeNull()
		})

		it('restores an active fact idempotently', async () => {
			await start()
			const user = await registerUser('facts-restore-idem@example.com')
			const fact = await seedFact(user, 'Снідаю о восьмій')

			const response = await user.agent.post(`${factUrl(fact.id)}/restore`).expect(200)

			expect(factSchema.parse(response.body).data.id).toBe(fact.id)
		})

		it('does not delete a foreign fact', async () => {
			await start()
			const user = await registerUser('facts-delete-foreign@example.com')
			const other = await registerUser('facts-delete-foreign-other@example.com')
			const foreign = await seedFact(other, 'Чужий факт')

			expectError(await user.agent.delete(factUrl(foreign.id)).expect(404), 'FACT_NOT_FOUND')
			expectError(
				await user.agent.post(`${factUrl(foreign.id)}/restore`).expect(404),
				'FACT_NOT_FOUND',
			)
			expect((await getFact(foreign.id)).deletedAt).toBeNull()
		})

		it('answers 409 FACTS_LIMIT_REACHED on restore with 30 confirmed', async () => {
			await start()
			const user = await registerUser('facts-restore-limit@example.com')
			const deleted = await seedFact(user, 'Видалений', { deletedAt: new Date() })
			await seedConfirmed(user, FACTS_MAX)

			const response = await user.agent.post(`${factUrl(deleted.id)}/restore`).expect(409)

			expect(expectError(response, 'FACTS_LIMIT_REACHED')).toEqual({ max: FACTS_MAX })
			expect((await getFact(deleted.id)).deletedAt).not.toBeNull()
		})

		it('answers 409 FACT_EXISTS on restore when the same text is active again', async () => {
			await start()
			const user = await registerUser('facts-restore-exists@example.com')
			const deleted = await seedFact(user, 'Снідаю о восьмій', { deletedAt: new Date() })
			const active = await seedFact(user, 'Снідаю о восьмій')

			const response = await user.agent.post(`${factUrl(deleted.id)}/restore`).expect(409)

			expect(expectError(response, 'FACT_EXISTS')).toEqual({ existingId: active.id })
		})
	})

	describe('answer', () => {
		it('accepts a proposal', async () => {
			await start()
			const user = await registerUser('facts-accept@example.com')
			const proposal = await seedFact(user, 'Снідаю о восьмій', { status: 'PROPOSED' })

			const response = await user.agent
				.post(`${factUrl(proposal.id)}/answer`)
				.send({ accept: true })
				.expect(200)

			expect(factSchema.parse(response.body).data.status).toBe('CONFIRMED')
			expect((await getFact(proposal.id)).status).toBe('CONFIRMED')
		})

		it('rejects a proposal', async () => {
			await start()
			const user = await registerUser('facts-reject@example.com')
			const proposal = await seedFact(user, 'Снідаю о восьмій', { status: 'PROPOSED' })

			const response = await user.agent
				.post(`${factUrl(proposal.id)}/answer`)
				.send({ accept: false })
				.expect(200)

			expect(factSchema.parse(response.body).data.status).toBe('REJECTED')
		})

		it('repeats the same answer idempotently and refuses the opposite one', async () => {
			await start()
			const user = await registerUser('facts-answer-twice@example.com')
			const accepted = await seedFact(user, 'Перший', { status: 'PROPOSED' })
			const rejected = await seedFact(user, 'Другий', { status: 'PROPOSED' })
			const answer = (id: string, accept: boolean) =>
				user.agent.post(`${factUrl(id)}/answer`).send({ accept })

			await answer(accepted.id, true).expect(200)
			const again = await answer(accepted.id, true).expect(200)
			expect(factSchema.parse(again.body).data.status).toBe('CONFIRMED')
			expectError(await answer(accepted.id, false).expect(409), 'FACT_NOT_PROPOSED')

			await answer(rejected.id, false).expect(200)
			await answer(rejected.id, false).expect(200)
			expectError(await answer(rejected.id, true).expect(409), 'FACT_NOT_PROPOSED')
			expect((await getFact(rejected.id)).status).toBe('REJECTED')
		})

		it('answers 404 for a foreign, a deleted and an unknown fact', async () => {
			await start()
			const user = await registerUser('facts-answer-404@example.com')
			const other = await registerUser('facts-answer-404-other@example.com')
			const foreign = await seedFact(other, 'Чужий', { status: 'PROPOSED' })
			const deleted = await seedFact(user, 'Видалений', { deletedAt: new Date() })

			for (const id of [foreign.id, deleted.id, UNKNOWN_ID]) {
				const response = await user.agent
					.post(`${factUrl(id)}/answer`)
					.send({ accept: true })
					.expect(404)
				expectError(response, 'FACT_NOT_FOUND')
			}
			expect((await getFact(foreign.id)).status).toBe('PROPOSED')
		})

		it('answers 409 FACTS_LIMIT_REACHED on accept with 30 confirmed, but still lets the user decline', async () => {
			await start()
			const user = await registerUser('facts-answer-limit@example.com')
			const proposal = await seedFact(user, 'Снідаю о восьмій', { status: 'PROPOSED' })
			await seedConfirmed(user, FACTS_MAX)

			const response = await user.agent
				.post(`${factUrl(proposal.id)}/answer`)
				.send({ accept: true })
				.expect(409)
			expect(expectError(response, 'FACTS_LIMIT_REACHED')).toEqual({ max: FACTS_MAX })
			expect((await getFact(proposal.id)).status).toBe('PROPOSED')

			await user.agent
				.post(`${factUrl(proposal.id)}/answer`)
				.send({ accept: false })
				.expect(200)
		})

		it('answers 422 on a bad body', async () => {
			await start()
			const user = await registerUser('facts-answer-422@example.com')
			const proposal = await seedFact(user, 'Снідаю о восьмій', { status: 'PROPOSED' })

			const response = await user.agent
				.post(`${factUrl(proposal.id)}/answer`)
				.send({ accept: 'yes' })
				.expect(422)

			expectError(response, 'VALIDATION_ERROR')
		})
	})

	describe('cleanup', () => {
		it('removes old deleted and stale unanswered facts, keeps the rest', async () => {
			await start()
			const user = await registerUser('facts-cleanup@example.com')
			const now = new Date()
			const daysAgo = (days: number): Date => new Date(now.getTime() - days * MS_PER_DAY)
			await seedFact(user, 'Давно видалений', { deletedAt: daysAgo(31) })
			const freshDeleted = await seedFact(user, 'Недавно видалений', { deletedAt: daysAgo(29) })
			await seedFact(user, 'Стара пропозиція', {
				status: 'PROPOSED',
				updatedAt: daysAgo(8),
			})
			await seedFact(user, 'Старий відхилений', {
				status: 'REJECTED',
				updatedAt: daysAgo(8),
			})
			const freshProposal = await seedFact(user, 'Свіжа пропозиція', {
				status: 'PROPOSED',
				updatedAt: daysAgo(6),
			})
			const oldConfirmed = await seedFact(user, 'Давній підтверджений', {
				updatedAt: daysAgo(100),
			})

			const removed = await app.get(FactsCleanupService).deleteExpired(now)

			expect(removed).toBe(3)
			const left = await prisma.userFact.findMany({ select: { id: true } })
			expect(left.map(({ id }) => id).sort()).toEqual(
				[freshDeleted.id, freshProposal.id, oldConfirmed.id].sort(),
			)
		})
	})
})
