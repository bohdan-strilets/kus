import type { SVGProps } from 'react'

import { HAMSTER_COLOR } from './hamster.colors'

/** Shared props for face lines (eyes closed, mouths). */
export const getLineProps = (width = 3): SVGProps<SVGPathElement> => ({
	stroke: HAMSTER_COLOR.eye,
	strokeWidth: width,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
	fill: 'none',
})
