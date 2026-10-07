import type { FoodArtwork, FoodIconKind } from './food-icon.types'

// Food pictograms, attribute for attribute from design/mockups (chat, today, today-over).
// Illustration colours, like the hamster's: they are artwork, not UI tokens.

export const FOOD_ARTWORK: Record<FoodIconKind, FoodArtwork> = {
	egg: {
		viewBox: 26,
		tile: '#FFF3D6',
		body: (
			<>
				<ellipse
					cx="13"
					cy="14"
					rx="9"
					ry="10.5"
					fill="#FFFFFF"
					stroke="#E9D9B8"
					strokeWidth="1.2"
				/>
				<circle cx="13" cy="15" r="4.6" fill="#F5B52E" />
			</>
		),
	},
	buckwheat: {
		viewBox: 26,
		tile: '#F4E9DF',
		body: (
			<>
				<path d="M3 12h20a10 10 0 0 1-20 0z" fill="#E9F1EC" stroke="#DCCBB9" strokeWidth="1.2" />
				<path d="M5 12c1-3.5 4.5-5 8-5s7 1.5 8 5z" fill="#9A6A42" />
				<circle cx="9" cy="10" r="0.9" fill="#6E4628" />
				<circle cx="13" cy="9" r="0.9" fill="#6E4628" />
				<circle cx="17" cy="10.2" r="0.9" fill="#6E4628" />
			</>
		),
	},
	coffee: {
		viewBox: 26,
		tile: '#EFE6DE',
		body: (
			<>
				<path
					d="M5 9h13v7a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"
					fill="#FFFFFF"
					stroke="#C9B6A6"
					strokeWidth="1.2"
				/>
				<path d="M18 11h1.5a2.5 2.5 0 0 1 0 5H18" fill="none" stroke="#C9B6A6" strokeWidth="1.2" />
				<ellipse cx="11.5" cy="9.6" rx="6" ry="1.6" fill="#B07A52" />
			</>
		),
	},
	chickenBuckwheat: {
		viewBox: 38,
		tile: '#FFFFFF',
		body: (
			<>
				<path d="M4 18h30a15 15 0 0 1-30 0z" fill="#F2F5F1" stroke="#C3D2C7" strokeWidth="1.3" />
				<path d="M7 18c1.5-5 6-7.5 12-7.5s10.5 2.5 12 7.5z" fill="#9A6A42" />
				<path d="M14 17c0-3 2.5-5 6-5s6 2 6 5z" fill="#E4A15A" />
				<path d="M18 13.5h7" stroke="#B9712F" strokeWidth="1.2" strokeLinecap="round" />
				<path d="M24 9c3-3 6-2.5 7-1-2.5 2.5-5 3-7 1z" fill="#5DBB63" />
			</>
		),
	},
	soup: {
		viewBox: 30,
		tile: '#FDE6D3',
		body: (
			<>
				<path d="M3 13h24a12 12 0 0 1-24 0z" fill="#FFFFFF" stroke="#E2C9B3" strokeWidth="1.2" />
				<path d="M6 13h18" stroke="#F2B544" strokeWidth="3" strokeLinecap="round" />
				<circle cx="11" cy="17" r="1.8" fill="#E77B3C" />
				<circle cx="17" cy="18" r="1.6" fill="#5DBB63" />
				<path d="M13 16h4" stroke="#E9D7B5" strokeWidth="2" strokeLinecap="round" />
			</>
		),
	},
	banana: {
		viewBox: 28,
		tile: '#FFF6CF',
		body: (
			<>
				<path
					d="M5 9c6 0 15 3 18 12-6-1-14-4-18-12z"
					fill="#F7D24A"
					stroke="#D9B02B"
					strokeWidth="1.2"
				/>
				<path d="M5 9l-1-3" stroke="#7A5A20" strokeWidth="1.6" strokeLinecap="round" />
			</>
		),
	},
	pizza: {
		viewBox: 28,
		tile: '#FDE6D3',
		body: (
			<>
				<path
					d="M4 22L14 4l10 18z"
					fill="#F5C451"
					stroke="#D99A2B"
					strokeWidth="1.2"
					strokeLinejoin="round"
				/>
				<circle cx="12" cy="15" r="2" fill="#D9534F" />
				<circle cx="16.5" cy="18" r="1.8" fill="#D9534F" />
				<circle cx="14" cy="10.5" r="1.5" fill="#D9534F" />
			</>
		),
	},
	// no mockup: the agreed neutral fallback — an empty plate on the `field` tile
	plate: {
		viewBox: 26,
		tile: '#F7F1E9',
		body: (
			<>
				<circle cx="13" cy="13" r="9.5" fill="#FFFFFF" stroke="#DCCBB9" strokeWidth="1.2" />
				<circle cx="13" cy="13" r="5.5" fill="none" stroke="#EADFD3" strokeWidth="1.2" />
			</>
		),
	},
}
