import { HAMSTER_COLORS as C } from './hamster.constants'
import { getLineProps } from './hamster-line'

/** Full body in the 0 0 120 120 viewBox. */
export const Body = () => (
	<>
		<ellipse cx="42" cy="111" rx="10" ry="5" fill={C.furDark} />
		<ellipse cx="78" cy="111" rx="10" ry="5" fill={C.furDark} />
		<circle cx="35" cy="30" r="11" fill={C.furDark} />
		<circle cx="35" cy="31" r="6" fill={C.earInner} />
		<circle cx="85" cy="30" r="11" fill={C.furDark} />
		<circle cx="85" cy="31" r="6" fill={C.earInner} />
		<ellipse cx="60" cy="68" rx="45" ry="43" fill={C.fur} />
		<circle cx="29" cy="74" r="15" fill={C.cheek} />
		<circle cx="91" cy="74" r="15" fill={C.cheek} />
		<ellipse cx="60" cy="84" rx="30" ry="25" fill={C.belly} />
		<path
			d="M46 34 Q60 28 74 34"
			stroke={C.furDark}
			strokeWidth="3"
			strokeLinecap="round"
			fill="none"
		/>
		<ellipse cx="31" cy="72" rx="7" ry="4" fill={C.blush} opacity="0.55" />
		<ellipse cx="89" cy="72" rx="7" ry="4" fill={C.blush} opacity="0.55" />
		<ellipse cx="60" cy="67" rx="3.6" ry="2.6" fill={C.nose} />
		<g stroke={C.whisker} strokeWidth="1.4" strokeLinecap="round">
			<path d="M22 66 l-10 -2" />
			<path d="M22 71 l-10 1" />
			<path d="M98 66 l10 -2" />
			<path d="M98 71 l10 1" />
		</g>
	</>
)

interface CookieProps {
	gradientId: string
	maskId: string
}

/** The logo cookie in its paws (bite + letter k) and the right paw. */
export const Cookie = ({ gradientId, maskId }: CookieProps) => (
	<>
		<circle cx="60" cy="98" r="15" fill={`url(#${gradientId})`} mask={`url(#${maskId})`} />
		<text
			x="58.5"
			y="104"
			textAnchor="middle"
			fontSize="16"
			className="font-sans font-extrabold"
			fill={C.logoLetter}
		>
			k
		</text>
		<ellipse cx="76" cy="98" rx="6.5" ry="5.5" fill={C.furDark} />
	</>
)

/** Gradient and bite mask for the cookie, in the 120 viewBox. */
export const CookieDefs = ({ gradientId, maskId }: CookieProps) => (
	<defs>
		<linearGradient id={gradientId} x1="0.15" y1="0.1" x2="0.85" y2="0.95">
			<stop offset="0" stopColor={C.logoFrom} />
			<stop offset="1" stopColor={C.logoTo} />
		</linearGradient>
		<mask id={maskId}>
			<rect width="120" height="120" fill="#FFFFFF" />
			<circle cx="74.6" cy="91.2" r="3.6" fill="#000000" />
			<circle cx="71.8" cy="86.6" r="3.6" fill="#000000" />
			<circle cx="67.1" cy="83.7" r="3.4" fill="#000000" />
		</mask>
	</defs>
)

export const PawLeft = () => <ellipse cx="45" cy="97" rx="6.5" ry="5.5" fill={C.furDark} />

export const PawWave = () => (
	<ellipse className="k-paw-wave" cx="18" cy="46" rx="6.5" ry="7.5" fill={C.furDark} />
)

export const Eyes = () => (
	<>
		<ellipse className="k-eye" cx="47" cy="57" rx="4.6" ry="5.6" fill={C.eye} />
		<circle cx="48.6" cy="55" r="1.7" fill={C.white} />
		<ellipse className="k-eye" cx="73" cy="57" rx="4.6" ry="5.6" fill={C.eye} />
		<circle cx="74.6" cy="55" r="1.7" fill={C.white} />
	</>
)

export const Smile = () => (
	<>
		<path d="M54 72 Q57 75 60 72 Q63 75 66 72" {...getLineProps(2.2)} />
		<rect
			x="57"
			y="73.6"
			width="2.8"
			height="3.8"
			rx="0.8"
			fill={C.white}
			stroke={C.toothLine}
			strokeWidth="0.6"
		/>
		<rect
			x="60.2"
			y="73.6"
			width="2.8"
			height="3.8"
			rx="0.8"
			fill={C.white}
			stroke={C.toothLine}
			strokeWidth="0.6"
		/>
	</>
)
