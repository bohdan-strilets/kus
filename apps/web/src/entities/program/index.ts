export type {
	ProgramChangeLine,
	ProgramChanges,
	ProgramExerciseResponse,
	ProgramNextResponse,
	ProgramResponse,
	ProgramTemplateResponse,
	ProgramVersionItem,
	ProgramVersionListResponse,
	TemplateExerciseTarget,
} from '@kus/shared'
export { getActiveProgram } from './api/get-active-program'
export { getProgramVersions } from './api/get-program-versions'
export {
	formatCardioTarget,
	formatProgramTarget,
	formatProgramTemplateMeta,
	formatProgramVersionDate,
	formatStrengthTarget,
	getProgramTemplateMeta,
	type ProgramTemplateMeta,
} from './lib/format-program'
export {
	activeProgramQueryOptions,
	PROGRAM_QUERY_KEY,
	programVersionsQueryOptions,
	setActiveProgram,
	useActiveProgram,
	useProgramVersions,
} from './model/program-query'
export {
	getProgramChangeGroups,
	type ProgramChangeContext,
	type ProgramChangeGroup,
	type ProgramChangeKind,
	type ProgramChangeRow,
} from './lib/format-program-changes'
export {
	formatProgramCreated,
	formatProgramSubtitle,
	formatProgramVersionWhen,
	formatProgramViewSubtitle,
	formatRotateHint,
} from './lib/format-program-screen'
export {
	getWeekdayLongName,
	getWeekdayShortName,
	PROGRAM_WEEKDAYS,
	toggleWeekday,
} from './lib/weekdays'
export { getExerciseGroup, getTemplateGroups } from './lib/get-template-groups'
export type { ProgramCardAction, ProgramCardControls } from './ui/program-card.types'
export { ProgramChangeList } from './ui/ProgramChangeList'
export { ProgramDiffCard } from './ui/ProgramDiffCard'
export { ProgramProposalCard } from './ui/ProgramProposalCard'
export { ProgramViewCard } from './ui/program-view-card'
