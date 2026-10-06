import { HAMSTER_COLORS as C } from './hamster.constants'
import { getHeadStrokeProps } from './hamster-line'

// Shared pieces of the head faces (viewBox 0 0 100 100), 1:1 with design/src/hamster/hamster-head.faces.tsx

/** Open left eye with a highlight (shared by smile and smileOpen). */
export const LeftEye = () => (
	<>
		<ellipse className="k-eye" cx="38" cy="47" rx="4.4" ry="5.4" fill={C.eye} />
		<circle cx="39.5" cy="45" r="1.6" fill={C.white} />
	</>
)

export const RightEye = () => (
	<>
		<ellipse className="k-eye" cx="62" cy="47" rx="4.4" ry="5.4" fill={C.eye} />
		<circle cx="63.5" cy="45" r="1.6" fill={C.white} />
	</>
)

/** Smile with two teeth. */
export const ToothySmile = () => (
	<>
		<path
			d="M44 63 Q47 66 50 63 Q53 66 56 63"
			{...getHeadStrokeProps(2.4)}
			strokeLinejoin="round"
		/>
		<rect x="47.2" y="64.4" width="2.6" height="3.6" rx="0.8" fill={C.white} />
		<rect x="50.2" y="64.4" width="2.6" height="3.6" rx="0.8" fill={C.white} />
	</>
)
