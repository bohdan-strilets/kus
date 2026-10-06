import { createHash, randomBytes } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { z } from 'zod'

import type { AuthenticatedUser } from '../../common/decorators'
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_BYTES } from './auth.constants'

const accessTokenPayloadSchema = z.object({ sub: z.uuid(), fam: z.uuid() })

@Injectable()
export class TokenService {
	constructor(private readonly jwtService: JwtService) {}

	signAccessToken({ sub, fam }: AuthenticatedUser): Promise<string> {
		return this.jwtService.signAsync({ sub, fam }, { expiresIn: ACCESS_TOKEN_TTL_SECONDS })
	}

	/** null for any invalid, expired or malformed token — the caller answers 401 either way. */
	async verifyAccessToken(token: string): Promise<AuthenticatedUser | null> {
		let payload: unknown
		try {
			payload = await this.jwtService.verifyAsync(token)
		} catch {
			// expected for expired or tampered tokens; not an error worth logging
			return null
		}
		const result = accessTokenPayloadSchema.safeParse(payload)
		return result.success ? result.data : null
	}

	generateRefreshToken(): string {
		return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url')
	}

	/** Only the hash is stored, so a DB leak doesn't hand out live sessions. */
	hashRefreshToken(token: string): string {
		return createHash('sha256').update(token).digest('hex')
	}
}
