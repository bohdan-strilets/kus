/** `details.fields.photo` of a 422: codes only, never a value taken from the photo. */
export const PHOTO_FIELD_CODES = {
	tooLarge: 'PHOTO_TOO_LARGE',
	unsupported: 'UNSUPPORTED_IMAGE',
	invalid: 'PHOTO_INVALID',
} as const

export type PhotoFieldCode = (typeof PHOTO_FIELD_CODES)[keyof typeof PHOTO_FIELD_CODES]
