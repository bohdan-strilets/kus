-- CreateEnum
CREATE TYPE "food_category" AS ENUM ('eggs', 'porridge', 'cereal', 'pancakes', 'toast', 'bread', 'pastry', 'dumplings', 'pasta', 'pizza', 'soup', 'borscht', 'meat', 'poultry', 'sausage', 'fish', 'seafood', 'potatoes', 'salad', 'vegetables', 'legumes', 'milk', 'yogurt', 'cottage_cheese', 'cheese', 'fruit', 'banana', 'berries', 'dried_fruit', 'nuts', 'snacks', 'protein_bar', 'chocolate', 'cake', 'ice_cream', 'cookies', 'coffee', 'tea', 'juice', 'soda', 'alcohol', 'protein_shake', 'fast_food', 'sauce', 'plate');

-- AlterTable
ALTER TABLE "food_entries" ADD COLUMN     "category" "food_category" NOT NULL DEFAULT 'plate';

-- AlterTable
ALTER TABLE "my_foods" ADD COLUMN     "category" "food_category" NOT NULL DEFAULT 'plate';

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "category" "food_category" NOT NULL DEFAULT 'plate';
