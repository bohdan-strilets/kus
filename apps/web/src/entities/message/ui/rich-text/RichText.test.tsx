// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { RichText } from './RichText'

describe('RichText', () => {
	afterEach(cleanup)

	it('renders paragraphs with bold and line breaks as text nodes', () => {
		const { container } = render(<RichText text={'Привіт **світ**\nдруга лінія'} />)
		expect(container.querySelector('strong')?.textContent).toBe('світ')
		expect(container.querySelectorAll('br')).toHaveLength(1)
	})

	it('renders a numbered list from its start number with aria-hidden markers', () => {
		const { container } = render(<RichText text={'3. перше\n4. друге'} />)
		const list = screen.getByRole('list')
		expect(list.tagName).toBe('OL')
		expect(list.textContent).toContain('3.перше')
		expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
	})

	it('renders a bullet list as ul', () => {
		render(<RichText text={'- а\n- б'} />)
		expect(screen.getByRole('list').tagName).toBe('UL')
	})

	it('keeps HTML as literal text', () => {
		const { container } = render(<RichText text={'<img src=x onerror=alert(1)> **ok**'} />)
		expect(container.querySelector('img')).toBeNull()
		expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
	})

	it('inline variant glues blocks with a space and drops block elements', () => {
		const { container } = render(
			<p>
				<RichText variant="inline" text={'## Назва\n- **а**\n- б\n\nкінець'} />
			</p>,
		)
		expect(container.querySelector('ul, ol, br')).toBeNull()
		expect(container.querySelector('strong')?.textContent).toBe('а')
		expect(container.textContent).toBe('Назва а б кінець')
	})

	it('renders a heading with its text', () => {
		const { container } = render(<RichText text={'## Підсумок\nтекст'} />)
		expect(container.textContent).toContain('Підсумок')
		expect(container.textContent).not.toContain('##')
	})

	it('draws bullet dots as aria-hidden markers inside ul[role=list]', () => {
		const { container } = render(<RichText text={'- а\n- б'} />)
		const list = container.querySelector('ul[role="list"]')
		expect(list).not.toBeNull()
		expect(list?.querySelectorAll('li')).toHaveLength(2)
		expect(list?.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
		expect(list?.textContent).toBe('аб')
	})

	it('inline variant has no p, ul or ol of its own', () => {
		const { container } = render(
			<div>
				<RichText variant="inline" text={'перший\nдругий\n\n- пункт\n1. номер'} />
			</div>,
		)
		expect(container.querySelector('p, ul, ol, li, br')).toBeNull()
		expect(container.textContent).toContain('перший другий')
	})

	describe('XSS', () => {
		const renderText = (text: string, variant?: 'block' | 'inline') =>
			render(<RichText text={text} variant={variant} />).container

		const expectNoEventHandlers = (container: HTMLElement) => {
			container.querySelectorAll('*').forEach((element) => {
				const names = element.getAttributeNames().filter((name) => name.startsWith('on'))
				expect(names).toEqual([])
			})
		}

		it('shows <script> literally', () => {
			const container = renderText('<script>alert(1)</script>')
			expect(container.querySelector('script')).toBeNull()
			expect(container.textContent).toContain('<script>alert(1)</script>')
			expectNoEventHandlers(container)
		})

		it('does not create img from an onerror payload', () => {
			const container = renderText('<img src=x onerror=alert(1)>')
			expect(container.querySelector('img')).toBeNull()
			expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
			expectNoEventHandlers(container)
		})

		it('does not turn a javascript: link into an anchor', () => {
			const container = renderText('[клік](javascript:alert(1))')
			expect(container.querySelector('a')).toBeNull()
			expect(container.querySelector('[href]')).toBeNull()
			expect(container.innerHTML).not.toContain('href')
		})

		it('keeps HTML inside bold as literal text', () => {
			const container = renderText('**<b>x</b>**')
			expect(container.querySelector('b')).toBeNull()
			expect(container.querySelector('strong')?.textContent).toBe('<b>x</b>')
		})

		it('does not decode HTML entities', () => {
			const container = renderText('&lt;b&gt;')
			expect(container.textContent).toBe('&lt;b&gt;')
			expect(container.querySelector('b')).toBeNull()
		})

		it('keeps an svg payload in a heading literal', () => {
			const container = renderText('### <svg onload=alert(1)>')
			expect(container.querySelector('svg')).toBeNull()
			expect(container.textContent).toContain('<svg onload=alert(1)>')
			expectNoEventHandlers(container)
		})

		it('has no on* attributes anywhere for a mixed payload, both variants', () => {
			const payload =
				'<img src=x onerror=alert(1)>\n- <svg onload=alert(1)>\n**<a onclick=alert(1)>x</a>**\n[a](javascript:alert(1))'
			expectNoEventHandlers(renderText(payload))
			expectNoEventHandlers(renderText(payload, 'inline'))
		})
	})
})
