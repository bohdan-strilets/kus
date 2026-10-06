import type { SVGProps } from 'react'

import { HAMSTER_COLORS } from './hamster.constants'

/** Shared props for face lines (eyes closed, mouths). */
export const getLineProps = (width = 3): SVGProps<SVGPathElement> => ({
	stroke: HAMSTER_COLORS.eye,
	strokeWidth: width,
	strokeLinecap: 'round',
	strokeLinejoin: 'round',
	fill: 'none',
})
