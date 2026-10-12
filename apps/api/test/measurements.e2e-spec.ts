import { Logger } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { MeasurementKind, MeasurementSource } from '../src/generated/prisma/client'
import { createFakeAiClient } from '../src/modules/ai/ai.test-utils'
import { MeasurementsService } from '../src/modules/measurements/measurements.service'
import type { PrismaService } from '../src/prisma'
import { createDbTestApp } from './create-db-test-app'

const fake = createFakeAiClient()

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`)
const moment = (iso: string): Date => new Date(`${iso}T08:00:00.000Z`)

describe('measurements (real DB)', () => {
	let app: NestExpressApplication
	let prisma: PrismaService
	let service: MeasurementsService
	const logSpies = [vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)]

	const start = async (): Promise<void> => {
		fake.reset()
		;({ app, prisma } = await createDbTestApp({ aiClient: fake.client }))
		service = app.get(MeasurementsService)
	}

	const createUser = async (email: string): Promise<string> => {
		const user = await prisma.user.create({
			data: { email, name: 'Test', timezone: 'Europe/Warsaw', consentAt: new Date() },
		})
		return user.id
	}

	const weigh = (userId: string, value: number, localDate: string) =>
		service.record({
			userId,
			kind: MeasurementKind.WEIGHT,
			value,
			localDate: day(localDate),
			measuredAt: moment(localDate),
			source: MeasurementSource.CHAT,
		})

	afterEach(async () => {
		await app.close()
	})

	afterAll(() => {
		for (const spy of logSpies) spy.mockRestore()
	})

	it('replaces the value of the same day and reads it back as a number', async () => {
		await start()
		const userId = await createUser('a@kus.app')

		await weigh(userId, 84.3, '2026-10-10')
		const replaced = await weigh(userId, 82.6, '2026-10-10')

		expect(replaced.value).toBe(82.6)
		expect(await prisma.measurement.count({ where: { userId } })).toBe(1)
		const latest = await service.findLatest({ userId, kind: MeasurementKind.WEIGHT })
		expect(latest?.value).toBe(82.6)
		expect(typeof latest?.value).toBe('number')
	})

	it('keeps the kinds apart and reads the latest by day', async () => {
		await start()
		const userId = await createUser('a@kus.app')

		await weigh(userId, 83, '2026-10-10')
		await weigh(userId, 82.4, '2026-10-12')
		await service.record({
			userId,
			kind: MeasurementKind.WAIST,
			value: 94,
			localDate: day('2026-10-12'),
			measuredAt: moment('2026-10-12'),
			source: MeasurementSource.CHAT,
		})

		expect((await service.findLatest({ userId, kind: MeasurementKind.WEIGHT }))?.value).toBe(82.4)
		expect((await service.findLatest({ userId, kind: MeasurementKind.WAIST }))?.value).toBe(94)
		const range = await service.findInRange({
			userId,
			kind: MeasurementKind.WEIGHT,
			from: day('2026-10-11'),
			to: day('2026-10-12'),
		})
		expect(range.map((row) => row.value)).toEqual([82.4])
	})

	it('keeps the current weight when a past day is logged later', async () => {
		await start()
		const userId = await createUser('a@kus.app')

		await weigh(userId, 82.4, '2026-10-12')
		await service.record({
			userId,
			kind: MeasurementKind.WEIGHT,
			value: 84,
			localDate: day('2026-10-11'),
			measuredAt: new Date('2026-10-12T20:00:00Z'),
			source: MeasurementSource.CHAT,
		})

		const latest = await service.findLatest({ userId, kind: MeasurementKind.WEIGHT })
		expect(latest?.value).toBe(82.4)
	})

	it('does not show one user’s values to another', async () => {
		await start()
		const owner = await createUser('owner@kus.app')
		const other = await createUser('other@kus.app')
		await weigh(owner, 80, '2026-10-12')

		const query = { userId: other, kind: MeasurementKind.WEIGHT }
		expect(await service.findLatest(query)).toBeNull()
		expect(await service.findFirst(query)).toBeNull()
		expect(
			await service.findInRange({ ...query, from: day('2026-10-01'), to: day('2026-10-31') }),
		).toEqual([])
	})

	it('takes the start by creation time: a backdated entry does not move it', async () => {
		await start()
		const userId = await createUser('a@kus.app')

		await weigh(userId, 85, '2026-10-10')
		await weigh(userId, 90, '2026-09-01')

		const first = await service.findFirst({ userId, kind: MeasurementKind.WEIGHT })
		expect(first?.value).toBe(85)
		const latest = await service.findLatest({ userId, kind: MeasurementKind.WEIGHT })
		expect(latest?.value).toBe(85)
	})

	it('goes with the user: nothing is left after the account is deleted', async () => {
		await start()
		const userId = await createUser('a@kus.app')
		await weigh(userId, 80, '2026-10-12')

		await prisma.user.delete({ where: { id: userId } })

		expect(await prisma.measurement.count({ where: { userId } })).toBe(0)
	})
})
