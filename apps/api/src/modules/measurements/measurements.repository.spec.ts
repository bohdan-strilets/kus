import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'

import { MeasurementKind, MeasurementSource } from '../../generated/prisma/client'
import type { PrismaService } from '../../prisma'
import { MeasurementsRepository } from './measurements.repository'

const USER_ID = 'user-1'
const ROW_ID = 'row-1'
const LOCAL_DATE = new Date('2026-10-18')

interface CallArg {
	where: Record<string, unknown>
	data: Record<string, unknown>
	update: Record<string, unknown>
	orderBy: unknown
}

const getFirstArg = (mock: Mock): CallArg => {
	const firstCall: unknown[] = mock.mock.calls[0] ?? []
	return firstCall[0] as CallArg
}

const createPrismaMock = () => ({
	measurement: {
		upsert: vi.fn().mockResolvedValue({}),
		findFirst: vi.fn().mockResolvedValue(null),
		findMany: vi.fn().mockResolvedValue([]),
		updateMany: vi.fn().mockResolvedValue({ count: 1 }),
	},
})

describe('MeasurementsRepository', () => {
	let prisma: ReturnType<typeof createPrismaMock>
	let repository: MeasurementsRepository

	beforeEach(() => {
		prisma = createPrismaMock()
		repository = new MeasurementsRepository(prisma as unknown as PrismaService)
	})

	it('revives a deleted row on upsert and keeps createdAt', async () => {
		await repository.upsert({
			userId: USER_ID,
			kind: MeasurementKind.WEIGHT,
			value: 80,
			localDate: LOCAL_DATE,
			measuredAt: new Date(),
			source: MeasurementSource.CHAT,
			messageId: null,
		})

		const { update } = getFirstArg(prisma.measurement.upsert)
		expect(update.deletedAt).toBeNull()
		expect(update).not.toHaveProperty('createdAt')
		expect(update).not.toHaveProperty('messageId')
	})

	it.each(['findLatest', 'findFirst', 'findStart', 'findBefore'] as const)(
		'%s skips deleted rows',
		async (method) => {
			await repository[method]({
				userId: USER_ID,
				kind: MeasurementKind.WEIGHT,
				before: LOCAL_DATE,
			})

			expect(getFirstArg(prisma.measurement.findFirst).where.deletedAt).toBeNull()
		},
	)

	it('findStart orders by day, then measuredAt, then createdAt; findFirst stays by createdAt', async () => {
		await repository.findStart({ userId: USER_ID, kind: MeasurementKind.WAIST })
		await repository.findFirst({ userId: USER_ID, kind: MeasurementKind.WAIST })

		const [start, first] = prisma.measurement.findFirst.mock.calls as unknown[][]
		expect((start?.[0] as CallArg).orderBy).toEqual([
			{ localDate: 'asc' },
			{ measuredAt: 'asc' },
			{ createdAt: 'asc' },
		])
		expect((first?.[0] as CallArg).orderBy).toEqual({ createdAt: 'asc' })
	})

	it('findByDate skips deleted rows', async () => {
		await repository.findByDate({
			userId: USER_ID,
			kind: MeasurementKind.WEIGHT,
			localDate: LOCAL_DATE,
		})

		expect(getFirstArg(prisma.measurement.findFirst).where.deletedAt).toBeNull()
	})

	it('findInRange and findRecent skip deleted rows', async () => {
		await repository.findInRange({
			userId: USER_ID,
			kind: MeasurementKind.WEIGHT,
			from: LOCAL_DATE,
			to: LOCAL_DATE,
		})
		await repository.findRecent({ userId: USER_ID, kind: MeasurementKind.WEIGHT, take: 3 })

		for (const call of prisma.measurement.findMany.mock.calls as unknown[][]) {
			expect((call[0] as CallArg).where.deletedAt).toBeNull()
		}
	})

	it('findByMessageIds keeps deleted rows for the chat card', async () => {
		await repository.findByMessageIds({ userId: USER_ID, messageIds: ['m1'] })

		expect(getFirstArg(prisma.measurement.findMany).where).not.toHaveProperty('deletedAt')
	})

	it('findByIdForUser returns deleted rows but only the owner’s', async () => {
		await repository.findByIdForUser(ROW_ID, USER_ID)

		expect(getFirstArg(prisma.measurement.findFirst).where).toEqual({
			id: ROW_ID,
			userId: USER_ID,
		})
	})

	it('softDelete only touches the owner’s live row', async () => {
		const isDeleted = await repository.softDelete(ROW_ID, USER_ID)

		const { where, data } = getFirstArg(prisma.measurement.updateMany)
		expect(where).toEqual({ id: ROW_ID, userId: USER_ID, deletedAt: null })
		expect(data.deletedAt).toBeInstanceOf(Date)
		expect(isDeleted).toBe(true)
	})

	it('softDelete reports a miss', async () => {
		prisma.measurement.updateMany.mockResolvedValue({ count: 0 })

		expect(await repository.softDelete(ROW_ID, USER_ID)).toBe(false)
	})

	it('restore only touches the owner’s deleted row', async () => {
		await repository.restore(ROW_ID, USER_ID)

		const { where, data } = getFirstArg(prisma.measurement.updateMany)
		expect(where).toEqual({ id: ROW_ID, userId: USER_ID, deletedAt: { not: null } })
		expect(data).toEqual({ deletedAt: null })
	})

	it('updateValue sets source EDIT on a live row of the owner', async () => {
		await repository.updateValue(ROW_ID, USER_ID, 79.5)

		const { where, data } = getFirstArg(prisma.measurement.updateMany)
		expect(where).toEqual({ id: ROW_ID, userId: USER_ID, deletedAt: null })
		expect(data).toEqual({ value: 79.5, source: MeasurementSource.EDIT })
	})
})
