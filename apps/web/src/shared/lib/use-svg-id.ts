import { useId } from 'react'

/** Unique id for SVG defs: useId gives «:r1:», and colons break url(#…) in some browsers. */
export const useSvgId = (prefix: string): string => prefix + useId().replace(/:/g, '')
