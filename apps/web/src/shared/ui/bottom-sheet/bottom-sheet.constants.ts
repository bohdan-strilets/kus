/** Drag the sheet down past this distance (px) or flick faster than this (px/s) to close it. */
export const CLOSE_DRAG_OFFSET_PX = 100
export const CLOSE_DRAG_VELOCITY = 500

/** Pulling up barely moves; pulling down follows the finger at half speed. */
export const DRAG_ELASTIC = { top: 0, bottom: 0.5 } as const

export const CLOSE_ICON_SIZE = 18
