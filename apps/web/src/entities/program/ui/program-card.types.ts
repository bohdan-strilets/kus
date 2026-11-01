import type { ProgramCardStatus } from '@kus/shared'

export type ProgramCardAction = 'accept' | 'rebase'

/** What the buttons of a program card do; the widget wires them to the mutations. */
export interface ProgramCardControls {
	status: ProgramCardStatus
	/** ACCEPTED only: when the version came («✓ Прийнято · версія від 31.10»). */
	versionCreatedAt: string | null
	/** The action in flight: its button shows the loader, every button is locked. */
	pendingAction: ProgramCardAction | null
	onAccept: () => void
	onRebase: () => void
	/** «Змінити в чаті»: the proposal card has it, the diff card does not. */
	onModify?: () => void
}
