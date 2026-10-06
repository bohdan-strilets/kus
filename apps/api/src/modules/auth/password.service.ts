import { randomBytes } from 'node:crypto'

import { Injectable, type OnModuleInit } from '@nestjs/common'
import { argon2id, hash as argon2Hash, verify as argon2Verify } from 'argon2'

const DUMMY_PASSWORD_BYTES = 32

/** argon2id with the library defaults (64 MiB, t=3, p=4) — at or above OWASP recommendations. */
@Injectable()
export class PasswordService implements OnModuleInit {
	// verified against when the account doesn't exist, so timing doesn't reveal that; hashed at boot,
	// because hashing on the first unknown-email login would make exactly that request slower
	private dummyHash: string | null = null

	async onModuleInit(): Promise<void> {
		this.dummyHash = await this.hash(randomBytes(DUMMY_PASSWORD_BYTES).toString('hex'))
	}

	hash(password: string): Promise<string> {
		return argon2Hash(password, { type: argon2id })
	}

	verify(passwordHash: string, password: string): Promise<boolean> {
		return argon2Verify(passwordHash, password)
	}

	/** Spends the same time as a real verify; the result is meaningless and ignored. */
	async verifyDummy(password: string): Promise<void> {
		if (!this.dummyHash) throw new Error('PasswordService used before onModuleInit')
		await argon2Verify(this.dummyHash, password)
	}
}
