export interface PhotoTileProps {
	/** null: the file is gone (messages from before the photos were stored, or deleted). */
	fileId: string | null
	/** Size of the stored picture from the API: only its proportions matter. */
	width: number
	height: number
	/** A blob: of a photo sent in this session: shown at once, the server copy is not requested. */
	previewUrl?: string
	alt: string
	className?: string
}

export type PhotoLoadStatus = 'loading' | 'loaded' | 'error'

/** How the request of one `src` + attempt ended; anything else is still loading. */
export interface PhotoLoadOutcome {
	key: string
	status: Exclude<PhotoLoadStatus, 'loading'>
}
