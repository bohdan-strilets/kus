import type { ReactNode } from 'react'

import { HAMSTER_COLOR as C } from './hamster.colors'
import { getLineProps } from './hamster-line'
import type { HeadMood } from './hamster.types'

/** Chat avatar faces, 1:1 with design/interactive/motion.html (viewBox 0 0 100 100). */
export const HEAD_FACES: Record<HeadMood, ReactNode> = {
	smile: (
		<>
			<ellipse className="k-eye" cx="38" cy="47" rx="4.4" ry="5.4" fill={C.eye} />
			<ellipse className="k-eye" cx="62" cy="47" rx="4.4" ry="5.4" fill={C.eye} />
			<path d="M44 63 Q47 66 50 63 Q53 66 56 63" {...getLineProps(2.4)} />
			<rect x="47.2" y="64.4" width="2.6" height="3.6" rx="0.8" fill={C.white} />
			<rect x="50.2" y="64.4" width="2.6" height="3.6" rx="0.8" fill={C.white} />
		</>
	),
	happy: (
		<>
			<path d="M33.5 48 Q38 42 42.5 48" {...getLineProps()} />
			<path d="M57.5 48 Q62 42 66.5 48" {...getLineProps()} />
			<path d="M43 62 Q50 74 57 62 Z" fill={C.eye} />
		</>
	),
	think: (
		<>
			<ellipse className="k-eye" cx="39.5" cy="45" rx="4.4" ry="5.4" fill={C.eye} />
			<ellipse className="k-eye" cx="63.5" cy="45" rx="4.4" ry="5.4" fill={C.eye} />
			<ellipse cx="51" cy="65" rx="2.6" ry="3" fill={C.eye} />
		</>
	),
	proud: (
		<>
			<path d="M33.5 47 Q38 42 42.5 47" {...getLineProps()} />
			<path d="M57.5 47 Q62 42 66.5 47" {...getLineProps()} />
			<path d="M44 63 Q50 67 57 61" {...getLineProps(2.4)} />
		</>
	),
}
