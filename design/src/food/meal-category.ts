import { FALLBACK_FOOD_CATEGORY, type FoodCategory } from './food.types';

type EntryLike = { category: FoodCategory | null; kcal: number };

/** Іконка прийому їжі = категорія найкалорійнішої позиції (вечеря з піцою → піца). */
export const getMealCategory = (entries: readonly EntryLike[]): FoodCategory => {
  const top = entries.reduce<EntryLike | null>((best, entry) => (!best || entry.kcal > best.kcal ? entry : best), null);
  return top?.category ?? FALLBACK_FOOD_CATEGORY;
};
