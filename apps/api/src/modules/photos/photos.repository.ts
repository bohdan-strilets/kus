import { Injectable } from '@nestjs/common'

import { type Prisma, StoredFileKind } from '../../generated/prisma/client'
import { PrismaService } from '../../prisma'

export interface CreateStoredFileData {
	id: string
	userId: string
	storageKey: string
	thumbKey: string
	width: number
	height: number
	sizeBytes: number
	thumbSizeBytes: number
}

/** What GET and DELETE need to know about a file; `attachment` is set once a message uses it. */
const OWNED_FILE_SELECT = {
	id: true,
	storageKey: true,
	thumbKey: true,
	mimeType: true,
	attachment: { select: { id: true } },
} as const

export type OwnedStoredFile = Prisma.StoredFileGetPayload<{ select: typeof OWNED_FILE_SELECT }>

const PHOTO_MIME_TYPE = 'image/jpeg'

@Injectable()
export class PhotosRepository {
	constructor(private readonly prisma: PrismaService) {}

	async create(data: CreateStoredFileData, tx?: Prisma.TransactionClient): Promise<void> {
		await (tx ?? this.prisma).storedFile.create({
			data: { ...data, kind: StoredFileKind.MESSAGE_PHOTO, mimeType: PHOTO_MIME_TYPE },
		})
	}

	countCreatedSince(
		{ userId, since }: { userId: string; since: Date },
		tx?: Prisma.TransactionClient,
	): Promise<number> {
		return (tx ?? this.prisma).storedFile.count({
			where: { userId, kind: StoredFileKind.MESSAGE_PHOTO, createdAt: { gte: since } },
		})
	}

	/** Filtered by the owner: another user's id is the same `null` as a missing one (IDOR). */
	findOwned(
		{ id, userId }: { id: string; userId: string },
		tx?: Prisma.TransactionClient,
	): Promise<OwnedStoredFile | null> {
		return (tx ?? this.prisma).storedFile.findFirst({
			where: { id, userId },
			select: OWNED_FILE_SELECT,
		})
	}

	/** `false` = nothing was deleted: the row is gone already or a message has taken the file since. */
	async deleteUnattached(
		{ id, userId }: { id: string; userId: string },
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const { count } = await (tx ?? this.prisma).storedFile.deleteMany({
			where: { id, userId, attachment: { is: null } },
		})
		return count === 1
	}
}
