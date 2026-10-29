/**
 * Parts of the chat that are drawn but not built yet. Off: the composer hides the camera (photo is
 * on since stage 3B), the right slot is always «Надіслати», the row of quick chips is gone
 * (on: only «Додати вагу», the other two chips of the mockup have no function yet).
 */
export const FEATURES = {
	photo: true,
	voice: false,
	quickChips: true,
	/**
	 * The «Тренування» tab and the five-tab bar with the raised «Чат» (nav-5-tabs). Off: four tabs as
	 * before; the route, the chat card and the row on «Сьогодні» stay on either way.
	 */
	workouts: false,
} as const
