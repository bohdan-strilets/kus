# Етап 3 — AI-ядро: що додати разом з ним

Етап ділиться на **3A** (текст + eval — зроблено), **3B** (фото) і **3C** (відповіді на уточнення й виправлення). Як працює 3A — `docs/architecture.md`, розділ «AI-ядро».

## Категорія страви (`category`)

Уже є: zod-enum `FOOD_CATEGORIES` / `foodCategorySchema` у [`packages/shared/src/schemas/enums.ts`](../packages/shared/src/schemas/enums.ts),
Prisma-enum `FoodCategory` і поле `category @default(plate)` у FoodEntry, MyFood і Recipe, іконки `<FoodIcon category>` на фронті.

Додати з AI-ядром:

- [x] **Інструмент `log_food`** (`packages/shared/src/ai/tools.ts`) — поле `category` у кожній позиції: обов'язкове, лише значення з `FOOD_CATEGORIES`, невпевнений → `plate`. Опис поля — текст із [`design/docs/food-categories.md`](../design/docs/food-categories.md), розділ «Для AI-інструменту `log_food`».
- [x] **zod-схема запису від AI** (`foodEntrySchema` у `packages/shared/src/schemas/food-entry.ts`) — `category: foodCategorySchema`; невідоме значення → `plate` (запис не відкидається: категорія впливає лише на іконку).
- [x] **Збереження** — сервіс пише `category` у FoodEntry; запис із пам'яті копіює категорію MyFood / Recipe як знімок (правило в [`docs/database.md`](database.md)).
- [x] **`packages/ai-eval`** — кейси з `design/docs/food-categories.md`: для кожної категорії типовий приклад і хоча б один пограничний із сусідньою (як радить скіл `add-food-category`). Категорія не впливає на калорії, тож її точність рахувати окремою метрикою, не змішувати з похибкою ккал.
- [x] **`PROMPT_CHANGELOG.md`** — перший рядок разом з промптом: дата, модель, похибка калорій і білка, токени на запит, точність категорій.

Порядок і чекліст — скіл `add-ai-tool` (`.claude/skills/add-ai-tool/`).

## 3B — фото (наступне)

- Той самий `POST /messages`, `multipart/form-data` (`photo` + `clientMessageId` + опційний `text`), ліміт 10 МБ, тип — за magic bytes.
- **HEIC — на клієнті:** перед завантаженням canvas → JPEG ~1600 px (prebuilt sharp не має HEVC-декодера). Сервер приймає JPEG/PNG/WebP; HEIC пробує через sharp, інакше `415 UNSUPPORTED_IMAGE`. Після рішення — оновити CLAUDE.md §6 (зараз там «HEIC → JPEG на бекенді»).
- sharp: `rotate()`, `resize(1600, 1600, inside)`, JPEG q≈80, **без метаданих** (GPS). Оригінал не зберігається (`storageKey = null`). `AI_MODEL_VISION`, `DailyUsage.photoCount` + `AI_DAILY_PHOTO_LIMIT`.
- Eval: етикетки (`source = LABEL`) і страви; реальні фото — лише в `data/private/`.

## 3C — уточнення й виправлення (наступне)

- Тап по варіанту: `POST /clarifications/:id/answer { optionIndex }` без AI — бекенд оновлює FoodEntry, `Clarification → ANSWERED`, IDOR-тест. Вільний текст — звичайне повідомлення з відкритими уточненнями в контексті.
- Виправлення: `PATCH /food-entries/:id` → `Correction` (лише змінені поля), `isEdited`; «Запам'ятати» → MyFood (на 100 г, `defaultGrams`/`pieceGrams`). У чаті «там було 200 г» — інструмент `correct_entry` за коротким ref.
- Записи з пам'яті (`memoryRef`): перевірку узгодженості ккал/макросів робити за цифрами MyFood (бекенд їх і так перераховує), а не за цифрами моделі — зараз неточна арифметика моделі може дати зайвий повтор (з рев'ю 3A).
- «Як завжди»: часті MyFood для типу прийому в контексті, `source: MEMORY`. Скасування — soft delete / restore.
- З живих прогонів (2026-10-07): опис цілого дня («сніданок…, обід…, вечеря…») зараз лягає в **один** прийом (за типом з тексту чи годиною) — потрібен `mealType` на позицію або кілька `log_food` за прийомами. На довгих «днях» модель не ставить жодного `clarify` (приватні кейси: 0 питань у 6 кейсах, де їх очікували) — вирішити, чи це нормально для запису «заднім числом», чи потрібне правило в промпті.
