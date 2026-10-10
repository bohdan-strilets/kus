import { SetMetadata } from '@nestjs/common'

export const ALLOW_PENDING_DELETION_KEY = 'allowPendingDeletion'

/**
 * Lets a route serve an account that is waiting to be purged (PendingDeletionGuard): only
 * restoring it, logging out and the minimal «who am I» — nothing that reads or writes its data.
 */
export const AllowPendingDeletion = (): MethodDecorator & ClassDecorator =>
	SetMetadata(ALLOW_PENDING_DELETION_KEY, true)
