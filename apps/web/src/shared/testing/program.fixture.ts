import type { ChatMessage, ProgramResponse } from '@kus/shared'

const PROGRAM_ID = '0199b3a4-0000-7000-8000-0000000000a1'
const VERSION_ID = '0199b3a4-0000-7000-8000-0000000000a2'

/** A program with no templates: enough for the cache and the request tests. */
export const makeProgram = (overrides: Partial<ProgramResponse> = {}): ProgramResponse => ({
	id: PROGRAM_ID,
	title: null,
	mode: 'ROTATE',
	perWeek: 3,
	pinnedTemplateId: null,
	version: { id: VERSION_ID, createdAt: '2026-11-01T10:00:00.000Z' },
	templates: [],
	next: null,
	...overrides,
})

/** A Kusik reply without any card; tests add the card they need. */
export const makeChatMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
	id: '0199b3a4-0000-7000-8000-000000000011',
	role: 'ASSISTANT',
	content: null,
	status: 'COMPLETED',
	clientMessageId: null,
	replyToId: null,
	createdAt: '2026-11-01T10:00:00.000Z',
	meals: [],
	clarifications: [],
	measurements: [],
	workouts: [],
	workoutCards: [],
	achievements: [],
	dayCard: null,
	statsCard: null,
	programCard: null,
	programCardState: null,
	programView: null,
	trainingOnboarding: null,
	trainingOnboardingState: null,
	savedFoods: [],
	factProposal: null,
	photo: null,
	...overrides,
})
