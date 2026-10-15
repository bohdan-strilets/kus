import type { StorageKind, StorageVariant } from './storage.types'

const THUMB_SUFFIX = '-thumb'

interface BuildStorageKeyInput {
	prefix: string
	userId: string
	kind: StorageKind
	fileId: string
	variant?: StorageVariant
}

/** Trailing slashes in the env prefix must not produce `dev//users/...`. */
const normalizePrefix = (prefix: string): string => prefix.replace(/\/+$/, '')

/** Everything a user owns in storage; the trailing slash keeps `u1` from matching `u10`. */
export const buildUserPrefix = ({ prefix, userId }: { prefix: string; userId: string }): string =>
	`${normalizePrefix(prefix)}/users/${userId}/`

export const buildStorageKey = ({
	prefix,
	userId,
	kind,
	fileId,
	variant = 'full',
}: BuildStorageKeyInput): string =>
	`${buildUserPrefix({ prefix, userId })}${kind}/${fileId}${variant === 'thumb' ? THUMB_SUFFIX : ''}`
