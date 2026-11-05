// What the model sees of the training program: the active one (templates under t-refs by
// position) and the rules of propose_program. Dynamic context only — never the cached prefix.
import type { ProgramMode } from '../schemas/enums.js'
import { toContextText } from './memory-context.js'

/**
 * The message talks about a program, so the rules come even without one: «програм…», «шаблон…»,
 * «3 рази на тиждень» (and the Polish «program», «szablon», «3 razy w tygodniu»). Not «програмування»,
 * «програмний» (nor the Polish «programowanie», «programista»): coding, not training.
 */
export const PROGRAM_TOPIC_PATTERN =
	/програм(?!ув|н)|шаблон|раз(?:и|ів)?\s+на\s+тиждень|program(?!ow|uj|ist)|szablon|raz(?:y)?\s+w\s+tygodniu/iu

export const isProgramTopic = (text: string): boolean => PROGRAM_TOPIC_PATTERN.test(text)

/** «давай так» after a talk about a program still gets the rules: the last turns count too. */
export const PROGRAM_TOPIC_HISTORY_TURNS = 4

/**
 * The rules without a program (and without a proposal): the message or one of the last
 * PROGRAM_TOPIC_HISTORY_TURNS turns of the history the model gets (user or Kusik) talks about one.
 * The backend and the eval decide it here, the same way.
 */
export const shouldShowProgramRules = ({
	text,
	history,
	hasProgram,
}: {
	text: string
	/** Oldest first, as the model gets it. */
	history: readonly { content: string }[]
	/** An active program or a proposal not accepted yet: the section is there anyway. */
	hasProgram: boolean
}): boolean =>
	!hasProgram &&
	(isProgramTopic(text) ||
		history.slice(-PROGRAM_TOPIC_HISTORY_TURNS).some(({ content }) => isProgramTopic(content)))

export interface ProgramExerciseContext {
	name: string
	/** Its `x…` in «Exercises», when listed there. */
	exerciseRef: string | null
	sets: number | null
	repsMin: number | null
	repsMax: number | null
	weightKg: number | null
	durationMin: number | null
	distanceKm: number | null
}

export interface ProgramTemplateContext {
	/** `t1`… by position. */
	ref: string
	name: string
	/** ISO 1–7. */
	weekdays: number[]
	exercises: ProgramExerciseContext[]
}

export interface ProgramContext {
	mode: ProgramMode
	perWeek: number | null
	title: string | null
	/** The t-ref of «next»; null when there is none. */
	nextRef: string | null
	templates: ProgramTemplateContext[]
}

/** The proposal of the open card: what the next change is built on; it has no «next». */
export type ProgramProposalContext = Omit<ProgramContext, 'nextRef'>

const TEMPLATE_REF_PREFIX = 't'

/**
 * t-refs of one turn across the active program and the open proposal, by template key: the active
 * templates are t1…tN by position; a proposal template keeps the t-ref of its key in the active
 * version, a new one gets tN+1… in the proposal's order.
 */
export const assignTemplateRefs = (
	activeKeys: readonly string[],
	proposalKeys: readonly string[],
): { active: string[]; proposal: string[] } => {
	const toRef = (index: number): string => `${TEMPLATE_REF_PREFIX}${index + 1}`
	const refByKey = new Map(activeKeys.map((key, index) => [key, toRef(index)]))
	const proposal = proposalKeys.map((key) => {
		const known = refByKey.get(key)
		if (known !== undefined) return known
		const ref = toRef(refByKey.size)
		refByKey.set(key, ref)
		return ref
	})
	return { active: activeKeys.map((_, index) => toRef(index)), proposal }
}

// rule lines of c6 §3, verbatim (approved by the author)
const PROGRAM_RULES = [
	'- The user often discusses the program first: answer and suggest in words (reply). Call propose_program only when the user asks to make or change it, or agrees.',
	'- propose_program always carries the whole program: every template and every exercise, unchanged ones too, with their t-refs and exact names from above. A change in words ("заміни жим ногами на присідання", "додай планку в А") → the whole program again with that change; the app shows what changed and asks to accept.',
	'- "Завжди А" → mode SINGLE with pinnedRef of that template; keep the other templates.',
	'- weightKg only when the user named it or "Exercises" has a past weight for it; for a beginner or without history leave it null. Never invent weights.',
	'- Level: a beginner → 2 workouts of simple moves, 3 sets of 10–15; some experience → 2–3 by rotation; confident and 4+ per week → more templates (upper / lower). At home without equipment → bodyweight only. Cardio 5–10 min at the start if the user does cardio.',
	'- Names: "Тренування А", "Тренування Б"… unless the user names them.',
	'- "Яка в мене програма?", "покажи програму" → reply with attach "program" and one short sentence (its idea or what is next), no exercises or numbers: the card shows the active program. No active program → say so; never present a proposal as the program.',
	"- Removing the program: only «Прибрати програму» on the program screen; you can't remove it — say where it is.",
] as const

const PROGRAM_HEADER = '# Program'
const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const KM_DECIMALS = 1

const formatReps = ({ repsMin, repsMax }: ProgramExerciseContext): string | null => {
	if (repsMin === null && repsMax === null) return null
	if (repsMin === null || repsMax === null || repsMin === repsMax) return `${repsMin ?? repsMax}`
	return `${repsMin}–${repsMax}`
}

/** «3×8–12 60 kg», «10 min»: the target, compact. */
const formatTarget = (exercise: ProgramExerciseContext): string => {
	const reps = formatReps(exercise)
	const volume =
		exercise.sets === null
			? reps === null
				? null
				: `${reps} reps`
			: reps === null
				? `${exercise.sets} sets`
				: `${exercise.sets}×${reps}`
	return [
		volume,
		exercise.weightKg === null ? null : `${exercise.weightKg} kg`,
		exercise.durationMin === null ? null : `${exercise.durationMin} min`,
		exercise.distanceKm === null ? null : `${exercise.distanceKm.toFixed(KM_DECIMALS)} km`,
	]
		.filter((part) => part !== null)
		.join(' ')
}

const formatProgramExercise = (exercise: ProgramExerciseContext): string => {
	const head = [exercise.exerciseRef, toContextText(exercise.name)]
		.filter((part) => part !== null)
		.join(' ')
	const target = formatTarget(exercise)
	return target === '' ? head : `${head} ${target}`
}

const formatWeekdays = (weekdays: readonly number[]): string =>
	weekdays.length === 0
		? ''
		: ` [${weekdays.map((day) => WEEKDAY_NAMES[day - 1] ?? String(day)).join(', ')}]`

/** «t1 "Тренування А" [Mon, Thu]: Бігова доріжка 10 min; x3 Жим лежачи 3×8–12 60 kg». */
export const formatProgramTemplate = (template: ProgramTemplateContext): string =>
	`${template.ref} "${toContextText(template.name)}"${formatWeekdays(template.weekdays)}: ${template.exercises.map(formatProgramExercise).join('; ')}`

/** «ROTATE, 3 per week, "Все тіло".» */
const formatSettings = ({ mode, perWeek, title }: ProgramProposalContext): string =>
	`${[
		mode,
		perWeek === null ? null : `${perWeek} per week`,
		title === null ? null : `"${toContextText(title)}"`,
	]
		.filter((part) => part !== null)
		.join(', ')}.`

/** «Active: ROTATE, 3 per week, "Все тіло". Next: t2.» */
const formatActive = (program: ProgramContext): string => {
	const next = program.nextRef === null ? '' : ` Next: ${program.nextRef}.`
	return `Active: ${formatSettings(program)}${next}`
}

// R2 of the 0.10.2 report, verbatim (approved by the author)
const PROPOSAL_LINE = 'Proposal not accepted yet (the card in the chat), build changes on it:'

export interface ProgramSectionInput {
	program?: ProgramContext | null
	/** The open card's proposal: after the active program, changes are built on it. */
	pendingProgram?: ProgramProposalContext | null
	/** The rules without a program: the message talks about one. */
	hasProgramRules?: boolean
	/** The answers of the training onboarding, already formatted; its last step asks for a program. */
	programOnboarding?: string | null
}

/**
 * The «Program» section: always with a program or an open proposal; without them only when the
 * talk is about a program or the onboarding asks for one. Empty otherwise.
 */
export const formatProgramSection = ({
	program = null,
	pendingProgram = null,
	hasProgramRules = false,
	programOnboarding = null,
}: ProgramSectionInput): string[] => {
	if (
		program === null &&
		pendingProgram === null &&
		!hasProgramRules &&
		programOnboarding === null
	) {
		return []
	}
	const active =
		program === null ? [] : [formatActive(program), ...program.templates.map(formatProgramTemplate)]
	const pending =
		pendingProgram === null
			? []
			: [
					PROPOSAL_LINE,
					formatSettings(pendingProgram),
					...pendingProgram.templates.map(formatProgramTemplate),
				]
	const onboarding =
		programOnboarding === null
			? []
			: [
					`Onboarding answers: ${programOnboarding}. Propose a program for them with propose_program.`,
				]
	return [PROGRAM_HEADER, ...active, ...pending, ...PROGRAM_RULES, ...onboarding]
}
