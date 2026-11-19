import type {
	ExpectedPot,
	ExpectedRecipe,
	ExpectedSavedRecipe,
	ExpectedValue,
} from './cases/case.types.js'
import type { CaseResult, LoggedItem, PotFacts, SavedRecipeCall } from './eval.types.js'

const isWithin = (expected: ExpectedValue, actual: number): boolean =>
	'exact' in expected
		? Math.abs(actual - expected.exact) < 0.5
		: actual >= expected.min && actual <= expected.max

/** unset = not judged, null = the model must not set it. */
const isValueRight = (
	expected: ExpectedValue | null | undefined,
	actual: number | null,
): boolean => {
	if (expected === undefined) return true
	if (expected === null) return actual === null
	return actual !== null && isWithin(expected, actual)
}

/** Every field given is checked; an ingredient stem is found in some ingredient name. */
export const isPotRight = (expected: ExpectedPot, actual: PotFacts): boolean =>
	(expected.ingredientStems ?? []).every((stem) =>
		actual.ingredientNames.some((name) => name.toLowerCase().includes(stem)),
	) &&
	(expected.minIngredients === undefined ||
		actual.ingredientNames.length >= expected.minIngredients) &&
	isValueRight(expected.waterMl, actual.waterMl) &&
	isValueRight(expected.cookedGrams, actual.cookedGrams) &&
	(expected.servings === undefined || expected.servings === actual.servings)

const isSavedRight = (expected: ExpectedSavedRecipe, got: SavedRecipeCall): boolean =>
	(expected.entryRef === undefined || expected.entryRef === got.entryRef) &&
	(expected.recipe === undefined ||
		(got.recipe !== null && isPotRight(expected.recipe, got.recipe))) &&
	isValueRight(expected.portionGrams, got.portionGrams)

const getPots = (items: LoggedItem[]): PotFacts[] =>
	items.flatMap((item) => (item.recipe ? [item.recipe] : []))

const getRecipeRefs = (items: LoggedItem[]): string[] =>
	items.flatMap((item) => (item.recipeRef ? [item.recipeRef] : []))

const hasWaterOptions = (
	want: NonNullable<ExpectedRecipe['clarifyWater']>,
	result: CaseResult,
): boolean =>
	result.clarifyCalls.some((call) => {
		const withWater = call.options.filter((option) => typeof option.waterMl === 'number')
		const hasUnknown = call.options.some((option) => option.waterMl === null)
		return withWater.length >= want.options && (!want.hasUnknown || hasUnknown)
	})

const isLoggedRight = (expected: ExpectedPot, items: LoggedItem[]): boolean => {
	const [only, ...rest] = getPots(items)
	return only !== undefined && rest.length === 0 && isPotRight(expected, only)
}

const isSavedSetRight = (
	expected: ExpectedSavedRecipe | null,
	saved: SavedRecipeCall[],
): boolean => {
	if (expected === null) return saved.length === 0
	const [only, ...rest] = saved
	return only !== undefined && rest.length === 0 && isSavedRight(expected, only)
}

/** The recipe tools did what the case expects; an unset part is not judged. */
export const isRecipeCorrect = (expected: ExpectedRecipe, result: CaseResult): boolean => {
	const pots = getPots(result.items)
	const refs = getRecipeRefs(result.items)
	return (
		(expected.logged === undefined || isLoggedRight(expected.logged, result.items)) &&
		(expected.recipeRef === undefined ||
			(pots.length === 0 && refs.length === 1 && refs[0] === expected.recipeRef)) &&
		(expected.noLoggedPot === undefined || (pots.length === 0 && refs.length === 0)) &&
		(expected.saved === undefined ||
			isSavedSetRight(expected.saved, result.calls.savedRecipes ?? [])) &&
		(expected.clarifyWater === undefined || hasWaterOptions(expected.clarifyWater, result))
	)
}
