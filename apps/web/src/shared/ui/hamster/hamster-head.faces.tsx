import type { ReactNode } from 'react'

import { HAMSTER_COLORS as C } from './hamster.constants'
import { LeftEye, RightEye, ToothySmile } from './hamster-head.parts'
import { getHeadStrokeProps } from './hamster-line'
import type { HamsterHeadMood } from './hamster.types'

// Head faces (viewBox 0 0 100 100), 1:1 with design/src/hamster/hamster-head.faces.tsx and the
// avatars in mockups/chat*.html — don't simplify. Shared eyes and smile live in hamster-head.parts.

export const HEAD_FACES: Record<HamsterHeadMood, ReactNode> = {
	/** Default in chat (Chat-v2 and most states): winks with the right eye, highlight in the left. */
	smile: (
		<>
			<LeftEye />
			<path d="M57.5 48 Q62 42.5 66.5 48" {...getHeadStrokeProps(3)} />
			<ToothySmile />
		</>
	),
	/** Both eyes open with highlights: new day, weekly summary, onboarding «activity». */
	smileOpen: (
		<>
			<LeftEye />
			<RightEye />
			<ToothySmile />
		</>
	),
	/** Happy: arc eyes, open mouth. */
	happy: (
		<>
			<path d="M33.5 48 Q38 42 42.5 48" {...getHeadStrokeProps(3)} />
			<path d="M57.5 48 Q62 42 66.5 48" {...getHeadStrokeProps(3)} />
			<path d="M43 62 Q50 74 57 62 Z" fill={C.eye} />
		</>
	),
	/** Thinking / typing / clarifying: eyes up with highlights, «o» mouth. */
	think: (
		<>
			<ellipse className="k-eye" cx="39.5" cy="45" rx="4.4" ry="5.4" fill={C.eye} />
			<circle cx="41" cy="43" r="1.6" fill={C.white} />
			<ellipse className="k-eye" cx="63.5" cy="45" rx="4.4" ry="5.4" fill={C.eye} />
			<circle cx="65" cy="43" r="1.6" fill={C.white} />
			<ellipse cx="51" cy="65" rx="2.6" ry="3" fill={C.eye} />
		</>
	),
	/** Proud: arc eyes, raised brows, half smile (weight, progress). */
	proud: (
		<>
			<path d="M33.5 47 Q38 42 42.5 47" {...getHeadStrokeProps(3)} />
			<path d="M57.5 47 Q62 42 66.5 47" {...getHeadStrokeProps(3)} />
			<path d="M33 37 l9 -2 M58 35 l9 2" stroke={C.brow} strokeWidth="2" strokeLinecap="round" />
			<path d="M44 63 Q50 67 57 61" {...getHeadStrokeProps(2.4)} />
		</>
	),
	/** Content: arc eyes, wavy smile (new recipe). */
	content: (
		<>
			<path d="M33.5 48 Q38 42 42.5 48" {...getHeadStrokeProps(3)} />
			<path d="M57.5 48 Q62 42 66.5 48" {...getHeadStrokeProps(3)} />
			<path d="M44 63 Q47 61 50 63 Q53 65 56 63" {...getHeadStrokeProps(2.4)} />
		</>
	),
	/** Oops: worried brows, wavy mouth (connection error). */
	oops: (
		<>
			<ellipse className="k-eye" cx="38" cy="48" rx="4.4" ry="5.4" fill={C.eye} />
			<circle cx="39.5" cy="46" r="1.6" fill={C.white} />
			<ellipse className="k-eye" cx="62" cy="48" rx="4.4" ry="5.4" fill={C.eye} />
			<circle cx="63.5" cy="46" r="1.6" fill={C.white} />
			<path d="M30 37 l9 3 M70 37 l-9 3" stroke={C.brow} strokeWidth="2.4" strokeLinecap="round" />
			<path d="M43 65 q2.3 -2 4.6 0 q2.3 2 4.6 0 q2.3 -2 4.6 0" {...getHeadStrokeProps(2.4)} />
		</>
	),
	/** Hungry: looking down, tongue out (onboarding «food», dinner tip). */
	hungry: (
		<>
			<ellipse className="k-eye" cx="38" cy="49" rx="4.4" ry="5.4" fill={C.eye} />
			<circle cx="39" cy="51" r="1.5" fill={C.white} />
			<ellipse className="k-eye" cx="62" cy="49" rx="4.4" ry="5.4" fill={C.eye} />
			<circle cx="63" cy="51" r="1.5" fill={C.white} />
			<path d="M44 63 Q50 67 56 63" {...getHeadStrokeProps(2.4)} />
			<path d="M52 64.5 q4 0 4 4 q0 3 -3 3 q-3 0 -3 -4z" fill={C.blush} />
		</>
	),
}
