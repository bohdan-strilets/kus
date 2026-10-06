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

/** Head face lines: no line join, unlike the full body (design/src/hamster/hamster-head.faces.tsx). */
export const getHeadStrokeProps = (width: number): SVGProps<SVGPathElement> => ({
	stroke: HAMSTER_COLORS.eye,
	strokeWidth: width,
	strokeLinecap: 'round',
	fill: 'none',
})
