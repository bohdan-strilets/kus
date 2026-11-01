import { ESCAPE_LOCAL_ATTRIBUTE } from './bottom-sheet.constants'

export const isLocalEscapeTarget = (target: EventTarget | null): boolean =>
	target instanceof Element && target.closest(`[${ESCAPE_LOCAL_ATTRIBUTE}]`) !== null
