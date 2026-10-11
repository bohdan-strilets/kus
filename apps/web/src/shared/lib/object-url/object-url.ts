/** blob: URLs made for this session (photo previews), so leaving it can revoke every one of them. */
const sessionUrls = new Set<string>()

export const createSessionObjectUrl = (blob: Blob): string => {
	const url = URL.createObjectURL(blob)
	sessionUrls.add(url)
	return url
}

export const revokeSessionObjectUrl = (url: string): void => {
	sessionUrls.delete(url)
	URL.revokeObjectURL(url)
}

/** On logout: the pictures of this account must not stay in memory for the next one. */
export const revokeSessionObjectUrls = (): void => {
	for (const url of sessionUrls) URL.revokeObjectURL(url)
	sessionUrls.clear()
}
