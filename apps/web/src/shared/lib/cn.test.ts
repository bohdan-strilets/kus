import { describe, expect, it } from 'vitest'

import { cn } from './cn'

describe('cn', () => {
	it('drops falsy values', () => {
		expect(cn('flex', false, undefined, 'gap-2')).toBe('flex gap-2')
	})

	it('lets the later Tailwind class win on conflict', () => {
		expect(cn('p-2', 'p-4')).toBe('p-4')
	})

	it('keeps a token font size next to a text colour', () => {
		expect(cn('text-big-number', 'text-ink')).toBe('text-big-number text-ink')
	})

	it('resolves conflicts between token font sizes, radii and shadows', () => {
		expect(cn('text-body', 'text-card-title')).toBe('text-card-title')
		expect(cn('rounded-card', 'rounded-tile-sm')).toBe('rounded-tile-sm')
		expect(cn('shadow-card', 'shadow-float')).toBe('shadow-float')
	})

	it('resolves token spacing against the default scale', () => {
		expect(cn('px-gutter', 'px-4')).toBe('px-4')
		expect(cn('min-h-button', 'min-h-tap')).toBe('min-h-tap')
	})

	it('keeps a gradient background next to a background colour', () => {
		expect(cn('bg-app', 'bg-surface')).toBe('bg-app bg-surface')
	})
})
