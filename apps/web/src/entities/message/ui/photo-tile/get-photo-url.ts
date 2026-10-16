import type { PhotoVariant } from '@kus/shared'

import { API_BASE_URL } from '@/shared/config'

/**
 * Where an <img> loads a stored photo. Same origin as the API (the Vercel rewrite in prod, the vite
 * proxy in dev), so the httpOnly auth cookie goes along without any token in JS.
 */
export const getPhotoUrl = (fileId: string, variant: PhotoVariant): string =>
	`${API_BASE_URL}/photos/${encodeURIComponent(fileId)}?variant=${variant}`
