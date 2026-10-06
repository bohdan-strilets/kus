import { HAMSTER_COLORS as C } from './hamster.constants'
import { getLineProps } from './hamster-line'
import { Eyes, Smile } from './hamster-parts'
import type { HamsterMood, MoodParts } from './hamster.types'

/** Per-mood artwork, 1:1 with design/mockups/brand-hamster.html (viewBox 0 0 120 120). */
export const HAMSTER_MOODS: Record<HamsterMood, MoodParts> = {
	wave: {
		back: (
			<path
				d="M8 36 q-3 4 0 8 M4 30 q-5 8 0 16"
				stroke={C.furDark}
				strokeWidth="1.8"
				strokeLinecap="round"
				fill="none"
			/>
		),
		paw: 'wave',
		face: (
			<>
				<Eyes />
				<Smile />
			</>
		),
	},
	happy: {
		back: (
			<>
				<path d="M12 16 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill={C.accent} />
				<path
					d="M104 18 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4z"
					fill={C.accentLight}
				/>
			</>
		),
		face: (
			<>
				<path d="M42 58 Q47 51 52 58" {...getLineProps()} />
				<path d="M68 58 Q73 51 78 58" {...getLineProps()} />
				<path d="M52 71 Q60 85 68 71 Z" fill={C.eye} />
				<rect x="57" y="71" width="2.8" height="3.6" rx="0.8" fill={C.white} />
				<rect x="60.2" y="71" width="2.8" height="3.6" rx="0.8" fill={C.white} />
				<ellipse cx="60" cy="79" rx="4" ry="2" fill={C.blush} />
			</>
		),
	},
	think: {
		back: (
			<>
				<circle cx="88" cy="20" r="3" fill={C.bubble} />
				<circle cx="97" cy="13" r="4" fill={C.bubble} />
				<circle cx="108" cy="8" r="5" fill={C.bubble} />
			</>
		),
		face: (
			<>
				<ellipse className="k-eye" cx="48" cy="55" rx="4.6" ry="5.6" fill={C.eye} />
				<circle cx="49.8" cy="52.6" r="1.7" fill={C.white} />
				<ellipse className="k-eye" cx="74" cy="55" rx="4.6" ry="5.6" fill={C.eye} />
				<circle cx="75.8" cy="52.6" r="1.7" fill={C.white} />
				<path
					d="M42 46 Q47 43 52 45"
					stroke={C.brow}
					strokeWidth="2"
					strokeLinecap="round"
					fill="none"
				/>
				<ellipse cx="61" cy="74" rx="2.8" ry="3.2" fill={C.eye} />
			</>
		),
	},
	logged: {
		face: (
			<>
				<ellipse className="k-eye" cx="47" cy="57" rx="4.6" ry="5.6" fill={C.eye} />
				<circle cx="48.6" cy="55" r="1.7" fill={C.white} />
				<path d="M68 58 Q73 53 78 58" {...getLineProps()} />
				<Smile />
			</>
		),
		front: (
			<>
				<circle cx="102" cy="96" r="11" fill={C.success} />
				<path
					d="M97 96 l3.5 3.5 6.5 -7"
					stroke={C.white}
					strokeWidth="2.8"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				/>
			</>
		),
	},
	support: {
		back: (
			<path
				d="M18 28 C10 22 8 14 14 11 C17 10 19 12 20 14 C21 12 23 10 26 11 C32 14 29 22 18 28 Z"
				fill={C.accentLight}
			/>
		),
		face: (
			<>
				<path d="M42 57 Q47 61 52 57" {...getLineProps()} />
				<path d="M68 57 Q73 61 78 57" {...getLineProps()} />
				<path d="M55 73 Q60 76 65 73" {...getLineProps(2.2)} />
			</>
		),
	},
	surprised: {
		back: (
			<text x="96" y="30" fontSize="24" className="font-sans font-extrabold" fill={C.accentLight}>
				!
			</text>
		),
		face: (
			<>
				<ellipse className="k-eye" cx="47" cy="56" rx="6" ry="7.2" fill={C.eye} />
				<circle cx="49" cy="53.4" r="2.2" fill={C.white} />
				<ellipse className="k-eye" cx="73" cy="56" rx="6" ry="7.2" fill={C.eye} />
				<circle cx="75" cy="53.4" r="2.2" fill={C.white} />
				<path
					d="M41 44 Q47 40 52 43"
					stroke={C.brow}
					strokeWidth="2"
					strokeLinecap="round"
					fill="none"
				/>
				<path
					d="M68 43 Q73 40 79 44"
					stroke={C.brow}
					strokeWidth="2"
					strokeLinecap="round"
					fill="none"
				/>
				<ellipse cx="60" cy="75" rx="3.6" ry="4.4" fill={C.eye} />
			</>
		),
	},
	yum: {
		over: (
			<>
				<circle cx="27" cy="75" r="19" fill={C.cheek} />
				<circle cx="93" cy="75" r="19" fill={C.cheek} />
				<ellipse cx="29" cy="72" rx="8" ry="4.5" fill={C.blush} opacity="0.55" />
				<ellipse cx="91" cy="72" rx="8" ry="4.5" fill={C.blush} opacity="0.55" />
			</>
		),
		face: (
			<>
				<path d="M42 58 Q47 52 52 58" {...getLineProps()} />
				<path d="M68 58 Q73 52 78 58" {...getLineProps()} />
				<path d="M54 73 Q57 71 60 73 Q63 75 66 73" {...getLineProps(2.2)} />
				<g fill={C.accent}>
					<circle cx="50" cy="80" r="1.2" />
					<circle cx="69" cy="80" r="1" />
					<circle cx="64" cy="83" r="0.9" />
				</g>
			</>
		),
	},
	hungry: {
		face: (
			<>
				<ellipse className="k-eye" cx="47" cy="59" rx="4.6" ry="5.6" fill={C.eye} />
				<circle cx="48.2" cy="61" r="1.6" fill={C.white} />
				<ellipse className="k-eye" cx="73" cy="59" rx="4.6" ry="5.6" fill={C.eye} />
				<circle cx="74.2" cy="61" r="1.6" fill={C.white} />
				<path d="M53 72 Q60 77 67 72" {...getLineProps(2.2)} />
				<path d="M62 74 q4 0 4 4 q0 3 -3 3 q-3 0 -3 -4z" fill={C.blush} />
			</>
		),
	},
	proud: {
		back: (
			<>
				<circle cx="102" cy="28" r="12" fill={C.accentLight} />
				<text
					x="102"
					y="33.5"
					textAnchor="middle"
					fontSize="15"
					className="font-sans font-extrabold"
					fill={C.white}
				>
					7
				</text>
			</>
		),
		face: (
			<>
				<path d="M42 57 Q47 52 52 57" {...getLineProps()} />
				<path d="M68 57 Q73 52 78 57" {...getLineProps()} />
				<path d="M42 47 l9 -2 M69 45 l9 2" stroke={C.brow} strokeWidth="2" strokeLinecap="round" />
				<path d="M54 72 Q60 76 67 70" {...getLineProps(2.2)} />
			</>
		),
	},
	remind: {
		back: (
			<>
				<path d="M14 30 q0 -12 10 -12 q10 0 10 12 l3 5 h-26z" fill={C.bell} />
				<circle cx="24" cy="38" r="2.6" fill={C.bell} />
				<path
					d="M8 20 q-3 4 -1 9 M40 20 q3 4 1 9"
					stroke={C.bell}
					strokeWidth="1.8"
					strokeLinecap="round"
					fill="none"
				/>
			</>
		),
		face: (
			<>
				<Eyes />
				<Smile />
			</>
		),
	},
	oops: {
		back: <path d="M96 36 q-5 7 0 10 q5 -3 0 -10z" fill={C.sweat} />,
		face: (
			<>
				<Eyes />
				<path
					d="M41 46 l10 3 M79 46 l-10 3"
					stroke={C.brow}
					strokeWidth="2"
					strokeLinecap="round"
				/>
				<path d="M53 74 q2.3 -2 4.6 0 q2.3 2 4.6 0 q2.3 -2 4.6 0" {...getLineProps(2.2)} />
			</>
		),
	},
	sleepy: {
		back: (
			<>
				<path d="M108 32 a11 11 0 1 1 -3 -16 a9 9 0 0 0 3 16z" fill={C.moon} />
				<text x="12" y="28" fontSize="11" className="font-sans font-extrabold" fill={C.bubble}>
					z
				</text>
				<text x="20" y="17" fontSize="15" className="font-sans font-extrabold" fill={C.bubble}>
					z
				</text>
			</>
		),
		face: (
			<>
				<path d="M42 57 Q47 61 52 57" {...getLineProps()} />
				<path d="M68 57 Q73 61 78 57" {...getLineProps()} />
				<ellipse cx="60" cy="74" rx="2.6" ry="2.2" fill={C.eye} />
			</>
		),
	},
}
