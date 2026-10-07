# Етап 3 — AI-ядро: що додати разом з ним

Нотатки, які мають з'явитися **разом** з AI-ядром (`log_food`, промпт, пакет `ai-eval`), а не раніше.
Поки цих частин немає, у коді нічого наперед не створюємо.

## Категорія страви (`category`)

Уже є: zod-enum `FOOD_CATEGORIES` / `foodCategorySchema` у [`packages/shared/src/schemas/enums.ts`](../packages/shared/src/schemas/enums.ts),
Prisma-enum `FoodCategory` і поле `category @default(plate)` у FoodEntry, MyFood і Recipe, іконки `<FoodIcon category>` на фронті.

Додати з AI-ядром:

- [ ] **Інструмент `log_food`** (`packages/shared/src/ai/tools.ts`) — поле `category` у кожній позиції: обов'язкове, лише значення з `FOOD_CATEGORIES`, невпевнений → `plate`. Опис поля — текст із [`design/docs/food-categories.md`](../design/docs/food-categories.md), розділ «Для AI-інструменту `log_food`».
- [ ] **zod-схема запису від AI** (`foodEntrySchema` у `packages/shared/src/schemas/food-entry.ts`) — `category: foodCategorySchema`; невалідне значення відкидається, як і решта полів.
- [ ] **Збереження** — сервіс пише `category` у FoodEntry; запис із пам'яті копіює категорію MyFood / Recipe як знімок (правило в [`docs/database.md`](database.md)).
- [ ] **`packages/ai-eval`** — кейси з `design/docs/food-categories.md`: для кожної категорії типовий приклад і хоча б один пограничний із сусідньою (як радить скіл `add-food-category`). Категорія не впливає на калорії, тож її точність рахувати окремою метрикою, не змішувати з похибкою ккал.
- [ ] **`PROMPT_CHANGELOG.md`** — перший рядок разом з промптом: дата, модель, похибка калорій і білка, токени на запит, точність категорій.

Порядок і чекліст — скіл `add-ai-tool` (`.claude/skills/add-ai-tool/`).
