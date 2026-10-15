/** The client re-encodes the full photo to this longer side; apart from the server's PHOTO_MAX_SIDE_PX. */
export const PHOTO_TARGET_SIDE_PX = 1568
/** The longer side of the thumbnail the chat grid shows. */
export const PHOTO_THUMB_SIDE_PX = 768
export const PHOTO_THUMB_MAX_BYTES = 150_000
/** Hard ceiling; the env PHOTOS_PER_MESSAGE_MAX can only lower it. */
export const PHOTOS_PER_MESSAGE_LIMIT = 6

const BASE64_CHARS_PER_GROUP = 4
const BYTES_PER_BASE64_GROUP = 3
export const PHOTO_THUMB_MAX_BASE64_LENGTH =
	Math.ceil(PHOTO_THUMB_MAX_BYTES / BYTES_PER_BASE64_GROUP) * BASE64_CHARS_PER_GROUP
