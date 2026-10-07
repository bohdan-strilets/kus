import type { FoodCategory, FoodGroup, FoodIconSize } from './food-icon.types'

export const FOOD_CATEGORY_GROUP: Record<FoodCategory, FoodGroup> = {
	eggs: 'grain',
	porridge: 'grain',
	cereal: 'grain',
	pancakes: 'grain',
	toast: 'grain',
	bread: 'grain',
	pastry: 'grain',
	dumplings: 'grain',
	pasta: 'grain',
	pizza: 'grain',
	soup: 'soup',
	borscht: 'soup',
	meat: 'protein',
	poultry: 'protein',
	sausage: 'protein',
	fish: 'protein',
	seafood: 'protein',
	potatoes: 'grain',
	salad: 'plant',
	vegetables: 'plant',
	legumes: 'plant',
	milk: 'dairy',
	yogurt: 'dairy',
	cottage_cheese: 'dairy',
	cheese: 'dairy',
	fruit: 'plant',
	banana: 'plant',
	berries: 'plant',
	dried_fruit: 'plant',
	nuts: 'plant',
	snacks: 'sweet',
	protein_bar: 'sweet',
	chocolate: 'sweet',
	cake: 'sweet',
	ice_cream: 'sweet',
	cookies: 'sweet',
	coffee: 'drink',
	tea: 'drink',
	juice: 'drink',
	soda: 'drink',
	alcohol: 'drink',
	protein_shake: 'dairy',
	fast_food: 'protein',
	sauce: 'neutral',
	plate: 'neutral',
}

export const FOOD_GROUP_TILE_CLASS: Record<FoodGroup, string> = {
	grain: 'bg-food-grain',
	soup: 'bg-food-soup',
	protein: 'bg-food-protein',
	plant: 'bg-food-plant',
	dairy: 'bg-food-dairy',
	sweet: 'bg-food-sweet',
	drink: 'bg-food-drink',
	neutral: 'bg-food-neutral',
}

/**
 * Tile and icon per place. The icon takes ~64 % of the tile (28 in 44, design/docs/components.md);
 * the recipe tip keeps the chat mockup's white 52 tile with a 38 icon.
 */
export const FOOD_ICON_SIZE: Record<
	FoodIconSize,
	{ tileClassName: string; iconPx: number; hasGroupTile: boolean }
> = {
	row: { tileClassName: 'size-9 rounded-icon', iconPx: 23, hasGroupTile: true },
	meal: { tileClassName: 'size-11 rounded-tile-sm', iconPx: 28, hasGroupTile: true },
	recipe: { tileClassName: 'size-13 rounded-tile bg-surface', iconPx: 38, hasGroupTile: false },
}
