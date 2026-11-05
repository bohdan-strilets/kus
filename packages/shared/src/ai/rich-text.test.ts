import { describe, expect, it } from 'vitest'

import { parseRichText } from './rich-text.js'

const t = (text: string) => ({ type: 'text', text })
const b = (text: string) => ({ type: 'strong', text })

describe('parseRichText', () => {
	it('splits paragraphs and keeps single newlines as lines', () => {
		expect(parseRichText('a\r\nb\n\n  \nc')).toEqual([
			{ type: 'paragraph', lines: [[t('a')], [t('b')]] },
			{ type: 'paragraph', lines: [[t('c')]] },
		])
	})

	it('parses short headings and keeps long ones as paragraphs', () => {
		expect(parseRichText('## Інгредієнти')).toEqual([
			{ type: 'heading', content: [t('Інгредієнти')] },
		])
		expect(parseRichText('# a b c d e f g')[0]?.type).toBe('paragraph')
		expect(parseRichText('#### x')[0]).toEqual({ type: 'paragraph', lines: [[t('#### x')]] })
	})

	it('parses bullet and ordered lists with start, flattening nesting', () => {
		expect(parseRichText('- a\n  * b\n• c')).toEqual([
			{ type: 'list', ordered: false, start: 0, items: [[t('a')], [t('b')], [t('c')]] },
		])
		expect(parseRichText('3) a\n4. b\n- c')).toEqual([
			{ type: 'list', ordered: true, start: 3, items: [[t('a')], [t('b')]] },
			{ type: 'list', ordered: false, start: 0, items: [[t('c')]] },
		])
	})

	it('handles strong: closed, unclosed, empty', () => {
		expect(parseRichText('a **b** c')).toEqual([
			{ type: 'paragraph', lines: [[t('a '), b('b'), t(' c')]] },
		])
		expect(parseRichText('a **b')[0]).toEqual({ type: 'paragraph', lines: [[t('a **b')]] })
		expect(parseRichText('a **** b')[0]).toEqual({ type: 'paragraph', lines: [[t('a **** b')]] })
	})

	it('keeps other markup literal', () => {
		for (const s of ['| a | b |', '[a](b)', '`x`', '> q', '*i*', '<b>x</b>&lt;'])
			expect(parseRichText(s)).toEqual([{ type: 'paragraph', lines: [[t(s)]] }])
	})

	it('parses # and ## as headings', () => {
		expect(parseRichText('# Назва\n## Підназва')).toEqual([
			{ type: 'heading', content: [t('Назва')] },
			{ type: 'heading', content: [t('Підназва')] },
		])
	})

	it('accepts a heading of exactly 6 words and 60 chars', () => {
		const text = [...'abcde'.split('').map(() => 'a'.repeat(10)), 'a'.repeat(5)].join(' ')
		expect(text).toHaveLength(60)
		expect(parseRichText(`# ${text}`)).toEqual([{ type: 'heading', content: [t(text)] }])
	})

	it('turns a heading over the word or char limit into a paragraph', () => {
		const sevenWords = 'a b c d e f g'
		expect(parseRichText(`# ${sevenWords}`)).toEqual([
			{ type: 'paragraph', lines: [[t(`# ${sevenWords}`)]] },
		])
		const long = [...'abcde'.split('').map(() => 'a'.repeat(10)), 'a'.repeat(6)].join(' ')
		expect(long).toHaveLength(61)
		expect(parseRichText(`# ${long}`)).toEqual([{ type: 'paragraph', lines: [[t(`# ${long}`)]] }])
	})

	it('keeps # without a space as a paragraph', () => {
		expect(parseRichText('#abc')).toEqual([{ type: 'paragraph', lines: [[t('#abc')]] }])
	})

	it('keeps a single newline inside a paragraph as two lines', () => {
		expect(parseRichText('one\ntwo')).toEqual([
			{ type: 'paragraph', lines: [[t('one')], [t('two')]] },
		])
	})

	it('takes the start of an ordered list from the first marker', () => {
		expect(parseRichText('5) a\n6) b')).toEqual([
			{ type: 'list', ordered: true, start: 5, items: [[t('a')], [t('b')]] },
		])
	})

	it('recognises the bullet marker', () => {
		expect(parseRichText('• a')).toEqual([
			{ type: 'list', ordered: false, start: 0, items: [[t('a')]] },
		])
	})

	it('splits blocks when the list kind changes', () => {
		expect(parseRichText('1. a\n- b\n2. c')).toEqual([
			{ type: 'list', ordered: true, start: 1, items: [[t('a')]] },
			{ type: 'list', ordered: false, start: 0, items: [[t('b')]] },
			{ type: 'list', ordered: true, start: 2, items: [[t('c')]] },
		])
	})

	it('starts a list right after a paragraph and a paragraph right after a list', () => {
		expect(parseRichText('intro\n- a\noutro')).toEqual([
			{ type: 'paragraph', lines: [[t('intro')]] },
			{ type: 'list', ordered: false, start: 0, items: [[t('a')]] },
			{ type: 'paragraph', lines: [[t('outro')]] },
		])
	})

	it('parses strong at the start, at the end and twice in one line', () => {
		expect(parseRichText('**a** b')).toEqual([{ type: 'paragraph', lines: [[b('a'), t(' b')]] }])
		expect(parseRichText('a **b**')).toEqual([{ type: 'paragraph', lines: [[t('a '), b('b')]] }])
		expect(parseRichText('**a** і **b**')).toEqual([
			{ type: 'paragraph', lines: [[b('a'), t(' і '), b('b')]] },
		])
	})

	it('does not join ** across a line break', () => {
		expect(parseRichText('**a\nb**')).toEqual([
			{ type: 'paragraph', lines: [[t('**a')], [t('b**')]] },
		])
	})

	it('keeps a whitespace-only strong as text', () => {
		expect(parseRichText('** **')).toEqual([{ type: 'paragraph', lines: [[t('** **')]] }])
	})

	it('treats an empty list item as a paragraph', () => {
		expect(parseRichText('- ')).toEqual([{ type: 'paragraph', lines: [[t('-')]] }])
		expect(parseRichText('1. ')).toEqual([{ type: 'paragraph', lines: [[t('1.')]] }])
	})

	it('returns [] for whitespace-only input', () => {
		expect(parseRichText('')).toEqual([])
		expect(parseRichText('  \n \r\n\t\n')).toEqual([])
	})

	it('never throws on any prefix of a non-trivial input', () => {
		const inputs = [
			'## Склад\n1. **яйця** 2 шт\n- сир\n\n**разом** ~300 ккал\r\n# a b c d e f g\n****\n- \n',
			'• a\n3) **b\n  * c** d\n#### x\n`code` > q | t |',
		]
		for (const input of inputs)
			for (let i = 0; i <= input.length; i += 1)
				expect(() => parseRichText(input.slice(0, i))).not.toThrow()
	})

	it('parses 10 000 asterisks quickly', () => {
		const start = performance.now()
		parseRichText('*'.repeat(10_000))
		expect(performance.now() - start).toBeLessThan(50)
	})
})
