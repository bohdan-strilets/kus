import { z } from 'zod'

// Mirror of the enums in apps/api/prisma/schema.prisma — keep values in sync.

export const localeSchema = z.enum(['uk', 'pl', 'en'])
export type Locale = z.infer<typeof localeSchema>

export const addressFormSchema = z.enum(['MASCULINE', 'FEMININE', 'NEUTRAL'])
export type AddressForm = z.infer<typeof addressFormSchema>

export const verificationTokenTypeSchema = z.enum(['EMAIL_VERIFY', 'PASSWORD_RESET'])
export type VerificationTokenType = z.infer<typeof verificationTokenTypeSchema>

export const sexSchema = z.enum(['FEMALE', 'MALE'])
export type Sex = z.infer<typeof sexSchema>

export const activityLevelSchema = z.enum([
	'SEDENTARY',
	'LIGHT',
	'MODERATE',
	'ACTIVE',
	'VERY_ACTIVE',
])
export type ActivityLevel = z.infer<typeof activityLevelSchema>

export const goalTypeSchema = z.enum(['LOSE', 'MAINTAIN', 'GAIN'])
export type GoalType = z.infer<typeof goalTypeSchema>

export const goalSourceSchema = z.enum(['CALCULATED', 'MANUAL'])
export type GoalSource = z.infer<typeof goalSourceSchema>

export const messageRoleSchema = z.enum(['USER', 'ASSISTANT'])
export type MessageRole = z.infer<typeof messageRoleSchema>

export const messageStatusSchema = z.enum(['PENDING', 'STREAMING', 'COMPLETED', 'FAILED'])
export type MessageStatus = z.infer<typeof messageStatusSchema>

export const attachmentStatusSchema = z.enum(['PENDING', 'PROCESSED', 'FAILED'])
export type AttachmentStatus = z.infer<typeof attachmentStatusSchema>

export const storedFileKindSchema = z.enum(['MESSAGE_PHOTO'])
export type StoredFileKind = z.infer<typeof storedFileKindSchema>

export const aiRunPurposeSchema = z.enum(['PARSE_FOOD', 'CHAT_REPLY', 'SUGGEST_MEAL', 'SUMMARY'])
export type AiRunPurpose = z.infer<typeof aiRunPurposeSchema>

export const aiRunStatusSchema = z.enum(['PENDING', 'SUCCEEDED', 'FAILED'])
export type AiRunStatus = z.infer<typeof aiRunStatusSchema>

export const toolCallStatusSchema = z.enum(['SUCCEEDED', 'REJECTED', 'FAILED'])
export type ToolCallStatus = z.infer<typeof toolCallStatusSchema>

export const clarificationStatusSchema = z.enum(['OPEN', 'ANSWERED', 'DISMISSED'])
export type ClarificationStatus = z.infer<typeof clarificationStatusSchema>

export const mealTypeSchema = z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER'])
export type MealType = z.infer<typeof mealTypeSchema>

export const foodSourceSchema = z.enum(['LABEL', 'MEMORY', 'REFERENCE', 'ESTIMATE', 'MANUAL'])
export type FoodSource = z.infer<typeof foodSourceSchema>

export const myFoodSourceSchema = z.enum(['LABEL', 'MANUAL', 'AI'])
export type MyFoodSource = z.infer<typeof myFoodSourceSchema>

export const factCategorySchema = z.enum(['FOOD', 'SCHEDULE', 'TRAINING', 'OTHER'])
export type FactCategory = z.infer<typeof factCategorySchema>

export const factStatusSchema = z.enum(['PROPOSED', 'CONFIRMED', 'REJECTED'])
export type FactStatus = z.infer<typeof factStatusSchema>

export const workoutPlaceSchema = z.enum(['GYM', 'HOME', 'OUTDOOR', 'OTHER'])
export type WorkoutPlace = z.infer<typeof workoutPlaceSchema>

export const exerciseKindSchema = z.enum(['STRENGTH', 'CARDIO', 'OTHER'])
export type ExerciseKind = z.infer<typeof exerciseKindSchema>

export const exerciseSourceSchema = z.enum(['MANUAL', 'AI_ESTIMATE', 'DEVICE'])
export type ExerciseSource = z.infer<typeof exerciseSourceSchema>

// The Prisma mirror (enum MuscleGroup and its row in enums-sync.spec.ts) comes with the 0.10.0
// migration. Cardio is not a muscle group: it is ExerciseKind CARDIO.
export const muscleGroupSchema = z.enum(['CHEST', 'BACK', 'LEGS', 'SHOULDERS', 'ARMS', 'CORE'])
export type MuscleGroup = z.infer<typeof muscleGroupSchema>

/**
 * Dish category — picks the icon only, never the numbers (design/docs/food-categories.md).
 * The single source of the list: the web icon pack and the AI tool take it from here.
 * Lowercase snake_case, as in the Prisma enum and the icon file names.
 */
export const FOOD_CATEGORIES = [
	'eggs',
	'porridge',
	'cereal',
	'pancakes',
	'toast',
	'bread',
	'pastry',
	'dumplings',
	'pasta',
	'pizza',
	'soup',
	'borscht',
	'meat',
	'poultry',
	'sausage',
	'fish',
	'seafood',
	'potatoes',
	'salad',
	'vegetables',
	'legumes',
	'milk',
	'yogurt',
	'cottage_cheese',
	'cheese',
	'fruit',
	'banana',
	'berries',
	'dried_fruit',
	'nuts',
	'snacks',
	'protein_bar',
	'chocolate',
	'cake',
	'ice_cream',
	'cookies',
	'coffee',
	'tea',
	'juice',
	'soda',
	'alcohol',
	'protein_shake',
	'fast_food',
	'sauce',
	'plate',
] as const
export const foodCategorySchema = z.enum(FOOD_CATEGORIES)
export type FoodCategory = z.infer<typeof foodCategorySchema>
/** Unknown or unsure → plate, never empty (the DB default too). */
export const FALLBACK_FOOD_CATEGORY: FoodCategory = 'plate'

export const measurementKindSchema = z.enum(['WEIGHT', 'WAIST'])
export type MeasurementKind = z.infer<typeof measurementKindSchema>

export const measurementSourceSchema = z.enum(['CHAT', 'PROFILE', 'EDIT'])
export type MeasurementSource = z.infer<typeof measurementSourceSchema>

export const achievementTypeSchema = z.enum(['WEIGHT_KG_LOST', 'FOOD_STREAK'])
export type AchievementType = z.infer<typeof achievementTypeSchema>
