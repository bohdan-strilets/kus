/**
 * What /dev/ui renders for the token sections. Full class names are spelled out so Tailwind's
 * scanner generates them. Token names are code identifiers, shown as-is (not UI copy).
 */

export interface ColorSwatch {
	name: string
	className: string
	/** Added on top of design/tokens (docs/design-tokens.md). */
	isAdded?: boolean
}

export const COLOR_GROUPS: readonly (readonly ColorSwatch[])[] = [
	[
		{ name: 'primary', className: 'bg-primary' },
		{ name: 'primary-deep', className: 'bg-primary-deep' },
		{ name: 'primary-soft', className: 'bg-primary-soft' },
		{ name: 'primary-selected', className: 'bg-primary-selected' },
	],
	[
		{ name: 'ink', className: 'bg-ink' },
		{ name: 'muted', className: 'bg-muted' },
		{ name: 'muted-strong', className: 'bg-muted-strong' },
		{ name: 'muted-soft', className: 'bg-muted-soft', isAdded: true },
	],
	[
		{ name: 'surface', className: 'bg-surface' },
		{ name: 'surface-glass', className: 'bg-surface-glass' },
		{ name: 'field', className: 'bg-field' },
		{ name: 'secondary', className: 'bg-secondary' },
	],
	[
		{ name: 'line', className: 'bg-line' },
		{ name: 'line-strong', className: 'bg-line-strong', isAdded: true },
		{ name: 'divider', className: 'bg-divider' },
		{ name: 'track', className: 'bg-track' },
		{ name: 'handle', className: 'bg-handle', isAdded: true },
		{ name: 'toggle-off', className: 'bg-toggle-off', isAdded: true },
	],
	[
		{ name: 'success', className: 'bg-success' },
		{ name: 'success-soft', className: 'bg-success-soft' },
		{ name: 'success-ink', className: 'bg-success-ink' },
		{ name: 'danger', className: 'bg-danger' },
		{ name: 'danger-soft', className: 'bg-danger-soft' },
	],
	[
		{ name: 'over', className: 'bg-over' },
		{ name: 'over-ink', className: 'bg-over-ink', isAdded: true },
		{ name: 'over-soft', className: 'bg-over-soft', isAdded: true },
		{ name: 'scrim', className: 'bg-scrim' },
	],
	[
		{ name: 'protein-bg', className: 'bg-protein-bg' },
		{ name: 'protein-ink', className: 'bg-protein-ink' },
		{ name: 'protein-bar', className: 'bg-protein-bar' },
		{ name: 'carbs-bg', className: 'bg-carbs-bg' },
		{ name: 'carbs-ink', className: 'bg-carbs-ink' },
		{ name: 'carbs-bar', className: 'bg-carbs-bar' },
		{ name: 'fat-bg', className: 'bg-fat-bg' },
		{ name: 'fat-ink', className: 'bg-fat-ink' },
		{ name: 'fat-bar', className: 'bg-fat-bar' },
	],
	[
		{ name: 'bg-app', className: 'bg-app' },
		{ name: 'bg-soft-card', className: 'bg-soft-card' },
		{ name: 'bg-dark-card', className: 'bg-dark-card' },
	],
]

export const TEXT_STYLES = [
	{ name: 'screen-title · 24/800', className: 'text-screen-title' },
	{ name: 'big-number · 30/800', className: 'text-big-number tabular-nums' },
	{ name: 'body · 15/500', className: 'text-body' },
	{ name: 'card-title · 14/700', className: 'text-card-title' },
	{ name: 'caption · 13/600', className: 'text-caption' },
	{ name: 'small · 12/600', className: 'text-small' },
	{ name: 'eyebrow · 12/700', className: 'text-small font-bold tracking-wider uppercase' },
] as const

export const RADII = [
	{ name: 'screen 40', className: 'rounded-screen' },
	{ name: 'sheet 28', className: 'rounded-sheet' },
	{ name: 'card 24', className: 'rounded-card' },
	{ name: 'bubble 20', className: 'rounded-bubble' },
	{ name: 'tile 16', className: 'rounded-tile' },
	{ name: 'chip 18', className: 'rounded-chip' },
	{ name: 'icon 12', className: 'rounded-icon' },
	{ name: 'badge 10 +', className: 'rounded-badge' },
	{ name: 'tile-sm 14 +', className: 'rounded-tile-sm' },
	{ name: 'bubble-ai 22 +', className: 'rounded-bubble-ai' },
	{ name: 'panel 26 +', className: 'rounded-panel' },
	{ name: 'nav 30 +', className: 'rounded-nav' },
] as const

export const SHADOWS = [
	{ name: 'card', className: 'shadow-card' },
	{ name: 'chip', className: 'shadow-chip' },
	{ name: 'accent', className: 'shadow-accent' },
	{ name: 'sheet', className: 'shadow-sheet' },
	{ name: 'float +', className: 'shadow-float' },
	{ name: 'field +', className: 'shadow-field' },
] as const
