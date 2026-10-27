import { Logger } from '@nestjs/common'
import type { AuthUser } from '@kus/shared'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Prisma } from '../../generated/prisma/client'
import type { PrismaService } from '../../prisma'
import type { AuthService } from '../auth/auth.service'
import type { SessionService } from '../auth/session.service'
import type { ChatGreetingsService } from '../chat/chat-greetings.service'
import type { UsersService } from '../users/users.service'
import { AccountRestoreExpiredException } from './account.exceptions'
import type { AccountRepository } from './account.repository'
import { AccountService } from './account.service'

const USER: AuthUser = {
	id: '01999a00-0000-7000-8000-000000000001',
	email: 'owner@kus.app',
	name: 'Богдан',
	addressAs: null,
	addressForm: 'NEUTRAL',
	locale: 'uk',
	timezone: 'Europe/Warsaw',
	createdAt: '2026-10-01T10:00:00.000Z',
	pendingDeletion: false,
	purgeAt: null,
}

describe('AccountService.restore', () => {
	// the transaction client is only passed through, so any object with identity will do
	const tx = { tag: 'tx' } as unknown as Prisma.TransactionClient
	const prisma = {
		$transaction: vi.fn(
			(run: (client: Prisma.TransactionClient) => Promise<unknown>): Promise<unknown> => run(tx),
		),
	}
	const accountRepository = {
		restore: vi.fn<AccountRepository['restore']>(),
		findDeletionState: vi.fn<AccountRepository['findDeletionState']>(),
	}
	const usersService = { getMe: vi.fn<UsersService['getMe']>() }
	const chatGreetings = { postWelcomeBack: vi.fn<ChatGreetingsService['postWelcomeBack']>() }
	const service = new AccountService(
		prisma as unknown as PrismaService,
		accountRepository as unknown as AccountRepository,
		{} as AuthService,
		{} as SessionService,
		usersService as unknown as UsersService,
		chatGreetings as unknown as ChatGreetingsService,
	)
	const logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)

	beforeEach(() => {
		vi.clearAllMocks()
		usersService.getMe.mockResolvedValue(USER)
		chatGreetings.postWelcomeBack.mockResolvedValue(undefined)
	})

	afterAll(() => {
		logSpy.mockRestore()
	})

	it('greets a restored account in the chat, inside the restore transaction', async () => {
		accountRepository.restore.mockResolvedValue(true)

		await expect(service.restore(USER.id)).resolves.toEqual(USER)

		expect(accountRepository.restore).toHaveBeenCalledExactlyOnceWith(
			{ userId: USER.id, now: expect.any(Date) as Date },
			tx,
		)
		// nothing extra on the happy path: the state is read only when restore changed nothing
		expect(accountRepository.findDeletionState).not.toHaveBeenCalled()
		expect(usersService.getMe).toHaveBeenCalledExactlyOnceWith(USER.id, tx)
		expect(chatGreetings.postWelcomeBack).toHaveBeenCalledExactlyOnceWith(USER, tx)
		expect(logSpy).toHaveBeenCalledOnce()
	})

	it('leaves an account that was not pending as it is: no greeting, no log', async () => {
		accountRepository.restore.mockResolvedValue(false)
		accountRepository.findDeletionState.mockResolvedValue({ purgeAt: null })

		await expect(service.restore(USER.id)).resolves.toEqual(USER)

		expect(accountRepository.findDeletionState).toHaveBeenCalledExactlyOnceWith(USER.id, tx)
		expect(chatGreetings.postWelcomeBack).not.toHaveBeenCalled()
		expect(logSpy).not.toHaveBeenCalled()
	})

	it('reads the clock once and passes the same moment to the repository', async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-10-16T10:00:00.000Z'))
		try {
			accountRepository.restore.mockResolvedValue(true)

			await service.restore(USER.id)

			expect(accountRepository.restore).toHaveBeenCalledExactlyOnceWith(
				{ userId: USER.id, now: new Date('2026-10-16T10:00:00.000Z') },
				tx,
			)
		} finally {
			vi.useRealTimers()
		}
	})

	describe('past purgeAt', () => {
		it.each([
			['in the past', new Date('2026-10-15T10:00:00.000Z')],
			['exactly now', new Date('2026-10-16T10:00:00.000Z')],
		])('refuses with ACCOUNT_RESTORE_EXPIRED (409) when purgeAt is %s', async (_name, purgeAt) => {
			accountRepository.restore.mockResolvedValue(false)
			accountRepository.findDeletionState.mockResolvedValue({ purgeAt })

			const error: unknown = await service.restore(USER.id).catch((e: unknown) => e)

			expect(error).toBeInstanceOf(AccountRestoreExpiredException)
			expect((error as AccountRestoreExpiredException).getStatus()).toBe(409)
			expect((error as AccountRestoreExpiredException).errorCode).toBe('ACCOUNT_RESTORE_EXPIRED')
			expect((error as AccountRestoreExpiredException).details).toEqual({})
		})

		it('posts no greeting, logs nothing and fails the transaction so it rolls back', async () => {
			accountRepository.restore.mockResolvedValue(false)
			accountRepository.findDeletionState.mockResolvedValue({
				purgeAt: new Date('2026-10-15T10:00:00.000Z'),
			})

			await expect(service.restore(USER.id)).rejects.toBeInstanceOf(AccountRestoreExpiredException)

			await expect(prisma.$transaction.mock.results[0]?.value).rejects.toBeInstanceOf(
				AccountRestoreExpiredException,
			)
			expect(chatGreetings.postWelcomeBack).not.toHaveBeenCalled()
			expect(usersService.getMe).not.toHaveBeenCalled()
			expect(logSpy).not.toHaveBeenCalled()
		})
	})

	it('lets a missing user fall through to getMe, which decides what to do', async () => {
		accountRepository.restore.mockResolvedValue(false)
		accountRepository.findDeletionState.mockResolvedValue(null)
		const notFound = new Error('user not found')
		usersService.getMe.mockRejectedValue(notFound)

		await expect(service.restore(USER.id)).rejects.toBe(notFound)

		expect(chatGreetings.postWelcomeBack).not.toHaveBeenCalled()
	})

	it('fails the whole transaction when the greeting cannot be written', async () => {
		accountRepository.restore.mockResolvedValue(true)
		const failure = new Error('insert failed')
		chatGreetings.postWelcomeBack.mockRejectedValue(failure)

		await expect(service.restore(USER.id)).rejects.toBe(failure)

		// the rejection reaches $transaction, which is what makes Prisma roll the restore back
		await expect(prisma.$transaction.mock.results[0]?.value).rejects.toBe(failure)
		expect(logSpy).not.toHaveBeenCalled()
	})
})
