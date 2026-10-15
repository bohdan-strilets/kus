import { Injectable } from '@nestjs/common'

import { Prisma, StoredFileKind } from '../../generated/prisma/client'
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

/** What a message needs to bind and read a photo: the attachment copies the size, the key finds the bytes. */
const MESSAGE_FILE_SELECT = {
	id: true,
	storageKey: true,
	width: true,
	height: true,
	sizeBytes: true,
	mimeType: true,
} as const

export type MessageStoredFile = Prisma.StoredFileGetPayload<{ select: typeof MESSAGE_FILE_SELECT }>

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

	/** Filtered by the owner; the order of the result is not the order of `ids`. */
	findManyOwned(
		{ ids, userId }: { ids: string[]; userId: string },
		tx?: Prisma.TransactionClient,
	): Promise<MessageStoredFile[]> {
		return (tx ?? this.prisma).storedFile.findMany({
			where: { id: { in: ids }, userId },
			select: MESSAGE_FILE_SELECT,
		})
	}

	/**
	 * Locks the owner's row until the transaction ends. A message binding the photo holds a
	 * FOR KEY SHARE lock on it (the file_id foreign key), so this waits for that insert to commit —
	 * and the delete after it sees the attachment. `false` = no such row (gone already, or not theirs).
	 */
	async lockOwned(
		{ id, userId }: { id: string; userId: string },
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const rows = await tx.$queryRaw<{ id: string }[]>(
			Prisma.sql`SELECT id FROM stored_files WHERE id = ${id}::uuid AND user_id = ${userId}::uuid FOR UPDATE`,
		)
		return rows.length === 1
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
