// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { isFocusReturnTarget } from './is-focus-return-target'

const make = (html: string): Element => {
	const host = document.createElement('div')
	host.innerHTML = html
	const element = host.firstElementChild
	if (!element) throw new Error('no element')
	return element
}

describe('isFocusReturnTarget', () => {
	it.each([
		'<button>Змінити</button>',
		'<a href="/app/memory">Пам’ять</a>',
		'<div role="button" tabindex="0">Рядок</div>',
		'<button role="tab">Продукти</button>',
	])('takes a control: %s', (html) => {
		expect(isFocusReturnTarget(make(html))).toBe(true)
	})

	it.each([
		'<div role="tabpanel" tabindex="0">список</div>',
		'<section tabindex="-1">список</section>',
		'<a>без посилання</a>',
	])('skips a container that only took the tap: %s', (html) => {
		expect(isFocusReturnTarget(make(html))).toBe(false)
	})
})
