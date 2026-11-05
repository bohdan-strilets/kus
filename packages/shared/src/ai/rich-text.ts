// Tiny total parser for the light markup the model may put into `reply` text (docs: plan 0.10.5, 2.1).
// Shared by the web renderer and the eval. Only headings, lists and **bold** are recognised; everything
// else (tables, links, backticks, quotes, *italic*, HTML) stays literal text. Linear scan, no regex backtracking.

export type RichInline = { type: 'text'; text: string } | { type: 'strong'; text: string }

export type RichBlock =
	| { type: 'paragraph'; lines: RichInline[][] }
	| { type: 'heading'; content: RichInline[] }
	| { type: 'list'; ordered: boolean; start: number; items: RichInline[][] }

export const HEADING_MAX_WORDS = 6
export const HEADING_MAX_CHARS = 60
const HEADING_MAX_HASHES = 3
const ORDERED_MARKER_MAX_DIGITS = 9
const STRONG_MARK = '**'
const BULLET_MARKS: readonly string[] = ['-', '*', '•']

interface ListMarker {
	ordered: boolean
	number: number
	content: string
}

const isDigit = (char: string): boolean => char >= '0' && char <= '9'

const pushText = (inlines: RichInline[], text: string): void => {
	if (text.length === 0) return
	const last = inlines[inlines.length - 1]
	if (last?.type === 'text') {
		last.text += text
		return
	}
	inlines.push({ type: 'text', text })
}

const parseInline = (line: string): RichInline[] => {
	const inlines: RichInline[] = []
	let position = 0
	while (position < line.length) {
		const open = line.indexOf(STRONG_MARK, position)
		if (open === -1) {
			pushText(inlines, line.slice(position))
			break
		}
		pushText(inlines, line.slice(position, open))
		const close = line.indexOf(STRONG_MARK, open + STRONG_MARK.length)
		if (close === -1) {
			pushText(inlines, line.slice(open))
			break
		}
		const inner = line.slice(open + STRONG_MARK.length, close)
		const end = close + STRONG_MARK.length
		if (inner.trim().length === 0) {
			pushText(inlines, line.slice(open, end))
		} else {
			inlines.push({ type: 'strong', text: inner })
		}
		position = end
	}
	return inlines
}

const parseListMarker = (line: string): ListMarker | null => {
	const text = line.trimStart()
	const first = text[0]
	if (first === undefined) return null
	if (BULLET_MARKS.includes(first) && text[1] === ' ') {
		const content = text.slice(2).trim()
		return content.length > 0 ? { ordered: false, number: 0, content } : null
	}
	let digits = 0
	while (digits < text.length && isDigit(text[digits] ?? '')) digits += 1
	if (digits === 0 || digits > ORDERED_MARKER_MAX_DIGITS) return null
	const delimiter = text[digits]
	if ((delimiter !== '.' && delimiter !== ')') || text[digits + 1] !== ' ') return null
	const content = text.slice(digits + 2).trim()
	if (content.length === 0) return null
	return { ordered: true, number: Number(text.slice(0, digits)), content }
}

const parseHeading = (line: string): string | null => {
	if (line[0] !== '#') return null
	let hashes = 0
	while (line[hashes] === '#') hashes += 1
	if (hashes > HEADING_MAX_HASHES || line[hashes] !== ' ') return null
	const content = line.slice(hashes + 1).trim()
	if (content.length === 0 || content.length > HEADING_MAX_CHARS) return null
	if (content.split(/\s+/).length > HEADING_MAX_WORDS) return null
	return content
}

export const parseRichText = (text: string): RichBlock[] => {
	const blocks: RichBlock[] = []
	let paragraph: RichInline[][] | null = null
	let list: Extract<RichBlock, { type: 'list' }> | null = null

	for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
		const line = rawLine.trim()
		if (line.length === 0) {
			paragraph = null
			list = null
			continue
		}
		const heading = parseHeading(line)
		if (heading !== null) {
			blocks.push({ type: 'heading', content: parseInline(heading) })
			paragraph = null
			list = null
			continue
		}
		const marker = parseListMarker(line)
		if (marker !== null) {
			paragraph = null
			if (list === null || list.ordered !== marker.ordered) {
				list = { type: 'list', ordered: marker.ordered, start: marker.number, items: [] }
				blocks.push(list)
			}
			list.items.push(parseInline(marker.content))
			continue
		}
		list = null
		if (paragraph === null) {
			paragraph = []
			blocks.push({ type: 'paragraph', lines: paragraph })
		}
		paragraph.push(parseInline(line))
	}
	return blocks
}
