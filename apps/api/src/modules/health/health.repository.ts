import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma'

@Injectable()
export class HealthRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** Rejects when the database can't be reached. */
	async ping(): Promise<void> {
		await this.prisma.$queryRaw`SELECT 1`
	}
}
