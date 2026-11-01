import {
	assignTemplateRefs,
	type ProgramContext,
	type ProgramDraft,
	type ProgramExerciseContext,
	type ProgramProposalContext,
	type ProgramResponse,
	type TemplateExerciseTarget,
} from '@kus/shared'

const M_PER_KM = 1000

/** What the t-refs of one chat turn stand for, and the version the turn's context was built on. */
export interface TemplateRefIds {
	/**
	 * t-ref → template key (stable across versions): propose_program. The active program's and the
	 * open proposal's.
	 */
	keys: ReadonlyMap<string, string>
	/** t-ref → template id of the active version only: log_workout.templateRef. */
	ids: ReadonlyMap<string, string>
	/** The active version the context showed (null without a program): a card is built only on it. */
	baseVersionId: string | null
}

export const NO_TEMPLATE_REFS: TemplateRefIds = {
	keys: new Map(),
	ids: new Map(),
	baseVersionId: null,
}

export interface ProgramChatContext {
	program: ProgramContext | null
	/** The open card's proposal; null when there is none. */
	pendingProgram: ProgramProposalContext | null
	refIds: TemplateRefIds
}

/** An exercise of the active version or of a proposal draft: the same fields matter. */
interface ExerciseSource {
	name: string
	exerciseId: string | null
	target: TemplateExerciseTarget
}

/** An exercise gets its x-ref only when «Exercises» lists it (`exerciseRefs`: dictionary id → x-ref). */
const toExerciseContext = (
	{ name, exerciseId, target }: ExerciseSource,
	exerciseRefs: ReadonlyMap<string, string>,
): ProgramExerciseContext => ({
	name,
	exerciseRef: exerciseId === null ? null : (exerciseRefs.get(exerciseId) ?? null),
	sets: target.sets,
	repsMin: target.repsMin,
	repsMax: target.repsMax,
	weightKg: target.weightKg,
	durationMin: target.durationMin,
	distanceKm: target.distanceM === null ? null : target.distanceM / M_PER_KM,
})

const toProposalContext = (
	draft: ProgramDraft,
	refs: readonly string[],
	exerciseRefs: ReadonlyMap<string, string>,
): ProgramProposalContext => ({
	mode: draft.mode,
	perWeek: draft.perWeek,
	title: draft.title,
	templates: draft.templates.map((template, index) => ({
		ref: refs[index] ?? '',
		name: template.name,
		weekdays: template.weekdays,
		exercises: template.exercises.map((exercise) => toExerciseContext(exercise, exerciseRefs)),
	})),
})

/**
 * The «Program» section of the model context: the active templates as t1… by position, then the
 * open card's proposal (`pending`), whose templates reuse the t-ref of their key or continue the
 * numbering (assignTemplateRefs).
 */
export const toProgramChatContext = (
	program: ProgramResponse | null,
	exerciseRefs: ReadonlyMap<string, string>,
	pending: ProgramDraft | null = null,
): ProgramChatContext => {
	const templates = [...(program?.templates ?? [])].sort((a, b) => a.position - b.position)
	const refs = assignTemplateRefs(
		templates.map(({ key }) => key),
		pending?.templates.map(({ key }) => key) ?? [],
	)
	const active = templates.map((template, index) => ({ template, ref: refs.active[index] ?? '' }))
	const keys = new Map([
		...active.map(({ template, ref }) => [ref, template.key] as const),
		...(pending?.templates ?? []).map(
			({ key }, index) => [refs.proposal[index] ?? '', key] as const,
		),
	])
	return {
		program:
			program === null
				? null
				: {
						mode: program.mode,
						perWeek: program.perWeek,
						title: program.title,
						nextRef:
							active.find(({ template }) => template.id === program.next?.templateId)?.ref ?? null,
						templates: active.map(({ template, ref }) => ({
							ref,
							name: template.name,
							weekdays: template.weekdays,
							exercises: template.exercises.map((exercise) =>
								toExerciseContext(exercise, exerciseRefs),
							),
						})),
					},
		pendingProgram:
			pending === null ? null : toProposalContext(pending, refs.proposal, exerciseRefs),
		refIds: {
			keys,
			ids: new Map(active.map(({ template, ref }) => [ref, template.id])),
			baseVersionId: program?.version.id ?? null,
		},
	}
}
