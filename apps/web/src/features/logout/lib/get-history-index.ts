/**
 * How many entries of this app session lie behind the current one. React Router keeps it in
 * `history.state.idx`; anything else in there (another router, a hand-made state) counts as 0.
 */
export const getHistoryIndex = (state: unknown): number => {
	if (typeof state !== 'object' || state === null) return 0
	const idx: unknown = Reflect.get(state, 'idx')
	return typeof idx === 'number' && Number.isInteger(idx) && idx > 0 ? idx : 0
}
