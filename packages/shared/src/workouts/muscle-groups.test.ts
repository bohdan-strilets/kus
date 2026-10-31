import { describe, expect, it } from 'vitest'

import type { MuscleGroup } from '../schemas/enums.js'
import { matchMuscleGroup, TRAINING_GROUP_ORDER } from './muscle-groups.js'

const expectGroup = (names: readonly string[], group: MuscleGroup | null): void => {
	for (const name of names) expect({ name, group: matchMuscleGroup(name) }).toEqual({ name, group })
}

describe('matchMuscleGroup — disputed cases (training-groups.md, 31.10)', () => {
	it('deadlifts and the Romanian deadlift are legs', () => {
		expectGroup(['станова', 'станова сумо', 'станова тяга', 'румунська тяга', 'RDL'], 'LEGS')
	})

	it('dips are chest, close-grip press is arms', () => {
		expectGroup(['бруси', 'віджимання на брусах'], 'CHEST')
		expectGroup(['жим вузьким хватом', 'жим лежачи вузьким хватом'], 'ARMS')
	})

	it('burpee, kettlebell swing and thruster are legs, farmer walk is core', () => {
		expectGroup(['бурпі', 'свінг гирі', 'трастер'], 'LEGS')
		expectGroup(['фермерська прогулянка', 'farmer walk'], 'CORE')
	})
})

describe('matchMuscleGroup — presses and the order of rules', () => {
	it('takes the specific press before the general one', () => {
		expectGroup(['жим лежачи'], 'CHEST')
		expectGroup(['жим ногами'], 'LEGS')
		expectGroup(['жим стоячи', 'армійський жим', 'жим Арнольда'], 'SHOULDERS')
	})

	it('leaves an ambiguous seated press to the model unless the target is named', () => {
		expectGroup(['жим сидячи', 'жим гантелей сидячи', 'жим сидя'], null)
		expectGroup(['жим гантелей сидячи над головою', 'армійський жим сидячи'], 'SHOULDERS')
		expectGroup(['жим у тренажері', 'жим від грудей у тренажері', 'жим від грудей сидячи'], 'CHEST')
	})

	it('knows the basics', () => {
		expectGroup(['підтягування'], 'BACK')
		expectGroup(['планка'], 'CORE')
	})

	it('ignores case, punctuation and spacing', () => {
		expectGroup(['Жим  лежачи.', '  ЖИМ ЛЕЖАЧИ!'], 'CHEST')
	})

	it('reads common Russian and English names', () => {
		expectGroup(['становая тяга', 'deadlift', 'hip thrust', 'squat', 'приседания'], 'LEGS')
		expectGroup(['bench press', 'отжимания'], 'CHEST')
		expectGroup(['pull-up', 'подтягивания', 'тяга верхнего блока'], 'BACK')
		expectGroup(['face pull', 'overhead press'], 'SHOULDERS')
		expectGroup(['bicep curl', 'triceps pushdown', 'французький жим', 'bench dips'], 'ARMS')
		expectGroup(['leg curl', 'біцепс стегна'], 'LEGS')
		expectGroup(['leg raise', 'скручування велосипед'], 'CORE')
	})
})

describe('matchMuscleGroup — no group', () => {
	it('returns null for an unknown name', () => {
		expectGroup(['абракадабра', '', '!!!'], null)
	})

	it('returns null for cardio', () => {
		expectGroup(['бігова доріжка', 'велосипед', 'rowing', 'біг'], null)
	})
})

// Every row of the table «Вправа → група» in design/docs/training-groups.md
const TABLE_ROWS: readonly [MuscleGroup | null, readonly string[]][] = [
	[
		null,
		[
			'бігова доріжка',
			'біг',
			'ходьба',
			'велотренажер',
			'вело',
			'гребний тренажер',
			'гребля',
			'еліптичний тренажер',
			'степер',
			'сходи',
			'скакалка',
			'плавання',
			'ВІІТ-кардіо',
		],
	],
	[
		'CHEST',
		[
			'жим лежачи штангою',
			'жим гантелей лежачи',
			'жим лежачи на похилій',
			'жим лежачи на зворотному нахилі',
			'жим у тренажері',
			'розведення гантелей',
			'кросовер',
			'метелик',
			'пек-дек',
			'віджимання',
			'віджимання з колін',
			'віджимання на брусах',
		],
	],
	[
		'BACK',
		[
			'підтягування широким хватом',
			'підтягування зворотним хватом',
			'тяга верхнього блока',
			'тяга горизонтального блока',
			'тяга штанги в нахилі',
			'тяга гантелі в нахилі',
			'тяга Т-грифа',
			'пуловер',
			'гіперекстензія',
			'супермен',
		],
	],
	[
		'LEGS',
		[
			'присідання зі штангою',
			'присідання з гантелею',
			'гоблет-присідання',
			'присідання в Сміті',
			'жим ногами',
			'випади',
			'болгарські присідання',
			'станова тяга',
			'станова тяга сумо',
			'румунська тяга',
			'розгинання ніг у тренажері',
			'згинання ніг у тренажері',
			'сідничний місток',
			'hip thrust',
			'відведення ноги',
			'підйоми на носки',
			'зашагування',
		],
	],
	[
		'SHOULDERS',
		[
			'жим штанги над головою',
			'жим гантелей над головою',
			'жим стоячи',
			'жим гантелей сидячи над головою',
			'жим Арнольда',
			'махи гантелями в сторони',
			'махи вперед',
			'тяга до підборіддя',
			'зворотні розведення',
			'face pull',
		],
	],
	[
		'ARMS',
		[
			'згинання рук на біцепс зі штангою',
			'згинання рук з гантелями',
			'молот',
			'згинання на біцепс на блоці',
			'розгинання на трицепс на блоці',
			'французький жим',
			'жим вузьким хватом',
			'віджимання від лави',
			"згинання зап'ястя",
			"розгинання зап'ястя",
		],
	],
	[
		'CORE',
		[
			'скручування',
			'підйоми ніг у висі',
			'підйоми ніг лежачи',
			'планка',
			'бокова планка',
			'російські скручування',
			'ролик для преса',
			'мертвий жук',
			'птах-собака',
			'нахили з вагою',
			'повороти з вагою',
		],
	],
]

describe('matchMuscleGroup — the training-groups.md table', () => {
	it.each(TABLE_ROWS)('%s', (group, names) => {
		expectGroup(names, group)
	})
})

describe('TRAINING_GROUP_ORDER', () => {
	it('shows cardio first, then the muscle groups', () => {
		expect(TRAINING_GROUP_ORDER).toEqual([
			'CARDIO',
			'CHEST',
			'BACK',
			'LEGS',
			'SHOULDERS',
			'ARMS',
			'CORE',
		])
	})
})
