---
name: add-prisma-model
description: Додати чи змінити модель, поле або enum у Prisma-схемі Kusik з міграцією й дзеркалом у zod. Використовуй для будь-якої зміни schema.prisma.
---

# Зміна схеми бази

## 0. Звір з поточним станом

Читай актуальний `apps/api/prisma/schema.prisma`, а не опис у документах. Модель може вже бути (схема спроєктована на весь домен).

## 1. Зміна

- Назви: моделі PascalCase в однині, поля camelCase.
- Дані користувача: `userId` + індекс, `createdAt`, `updatedAt`, і `deletedAt DateTime?` для того, що можна «скасувати» (Meal, FoodEntry, MyFood, Recipe, UserFact, ExerciseEntry).
- Нове обов'язкове поле в наявній таблиці — з `@default` або двома міграціями (додати nullable → заповнити → зробити обов'язковим).
- Числа їжі: цілі ккал, грами — `Decimal`/`Float` за наявною конвенцією в схемі.

## 2. Enum — завжди в двох місцях

`schema.prisma` ↔ `packages/shared/src/schemas/enums.ts` (zod). Значення snake_case, однакові символ у символ.
Ніколи не перейменовуй значення enum на місці: додай нове → перенеси дані → видали старе.

## 3. Міграція

```bash
pnpm --filter api prisma migrate dev --name <коротко-що-змінилось>
```

Переглянь згенерований SQL: немає `DROP` того, що не мало зникнути; для великих таблиць — індекси.
Ніколи не редагуй уже застосовану міграцію.

## 4. Код навколо

- Repository: усі вибірки з `userId` і `deletedAt: null`.
- zod-схеми DTO в `packages/shared` під нові поля.
- `docs/database.md` — опис і діаграма.

## Готово, коли

- [ ] міграція створена й переглянута; enum синхронізовані
- [ ] repository фільтрує `userId` / `deletedAt`
- [ ] `docs/database.md` оновлено; тести зелені; звіт за `/verify`
