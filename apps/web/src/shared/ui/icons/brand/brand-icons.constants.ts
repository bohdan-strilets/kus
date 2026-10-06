/**
 * Colours drawn inside the brand icons (design/mockups/chat.html, today.html). They belong to the
 * icon artwork, like the hamster's, so they are not UI tokens.
 */
export const BRAND_ICON_COLORS = {
	/** «Сьогодні» ring track on an inactive tab */
	ringTrack: '#E8DED3',
	/** «Сьогодні» ring track on the active tab (on primary-soft) */
	ringTrackActive: '#F2C9A6',
	/** dots inside the filled chat bubble of the active «Чат» tab */
	bubbleDots: '#FFFFFF',
} as const

/** Nav icons are 22px, composer icons 20px, «send» 18px (design/CLAUDE-design.md rule 6). */
export const BRAND_ICON_SIZE = { nav: 22, composer: 20, send: 18 } as const

/** Opacity of the area under the line on the active «Прогрес» tab. */
export const PROGRESS_AREA_OPACITY = 0.22
