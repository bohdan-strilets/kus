// A read tool leaves a short digest of what it told the model: the next turns see it in front of
// Kusik's reply ("[Kusik: read workouts …]"), so numbers quoted from a lookup keep their source.
// The backend builds it from the same data as the tool result; the model never writes it.

/** The longest digest of one read, in characters. */
export const READ_DIGEST_MAX_CHARS = 200
/** Reads of one turn whose digest reaches the history (the loop allows no more rounds anyway). */
export const READ_DIGESTS_MAX_PER_TURN = 2

const ELLIPSIS = '…'
const PART_SEPARATOR = '; '

/**
 * `head; part; part` that fits READ_DIGEST_MAX_CHARS: the last parts go first, the head is cut
 * only when it alone is too long.
 */
export const joinReadDigest = (head: string, parts: readonly string[]): string => {
	const kept = [...parts]
	let text = [head, ...kept].join(PART_SEPARATOR)
	while (text.length > READ_DIGEST_MAX_CHARS && kept.length > 0) {
		kept.pop()
		text = [head, ...kept].join(PART_SEPARATOR)
	}
	return text.length > READ_DIGEST_MAX_CHARS
		? `${text.slice(0, READ_DIGEST_MAX_CHARS - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`
		: text
}
