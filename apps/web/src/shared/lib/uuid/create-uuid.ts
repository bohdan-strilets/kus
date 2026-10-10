const UUID_BYTES = 16
/** Byte that carries the version nibble, and the one with the variant bits (RFC 9562 §4). */
const VERSION_BYTE_INDEX = 6
const VARIANT_BYTE_INDEX = 8
const VERSION_4 = 0x40
const VARIANT_RFC = 0x80
/** Hex digits before each hyphen of the 8-4-4-4-12 layout. */
const GROUP_ENDS = [8, 12, 16, 20]
const HEX_RADIX = 16

const toHex = (byte: number): string => byte.toString(HEX_RADIX).padStart(2, '0')

/**
 * A version 4 UUID from crypto.getRandomValues, not crypto.randomUUID(): the latter exists only in
 * secure contexts, and the dev build is opened from a phone over plain http on the LAN, where a
 * tap on «надіслати» would throw before the request is made.
 */
export const createUuid = (): string => {
	const bytes = crypto.getRandomValues(new Uint8Array(UUID_BYTES))
	bytes[VERSION_BYTE_INDEX] = ((bytes[VERSION_BYTE_INDEX] ?? 0) & 0x0f) | VERSION_4
	bytes[VARIANT_BYTE_INDEX] = ((bytes[VARIANT_BYTE_INDEX] ?? 0) & 0x3f) | VARIANT_RFC
	const hex = Array.from(bytes, toHex).join('')
	let start = 0
	const groups: string[] = []
	for (const end of GROUP_ENDS) {
		groups.push(hex.slice(start, end))
		start = end
	}
	groups.push(hex.slice(start))
	return groups.join('-')
}
