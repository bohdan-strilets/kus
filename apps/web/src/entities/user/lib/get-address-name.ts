import { getVocative } from '@/shared/lib'

export interface Addressee {
	name: string | null
	/** «Як до тебе звертатися?» from the profile; wins over the vocative of the name. */
	addressAs: string | null
}

/** How Kusik calls the user: their own choice, else a safe vocative of the name, else nothing. */
export const getAddressName = ({ name, addressAs }: Addressee): string | null => {
	const chosen = addressAs?.trim()
	if (chosen) return chosen
	return name ? getVocative(name) : null
}
