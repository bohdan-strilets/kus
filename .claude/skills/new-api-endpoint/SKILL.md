---
name: new-api-endpoint
description: Додати ендпоінт або новий модуль у NestJS-бекенд Kusik (controller, service, repository, DTO на zod із packages/shared, e2e). Використовуй для будь-якого нового маршруту /api/v1/... чи зміни контракту.
---

# Новий ендпоінт API

Правила — розділи 5 і 10 `CLAUDE.md`. Тут — порядок дій.

## 1. Контракт спершу

1. zod-схеми запиту й відповіді — у `packages/shared` (одна схема для фронту й бекенду).
2. Маршрут: `/api/v1/<ресурс-у-множині>` kebab-case. `/me` реєструється **перед** `/:id`.
3. Формат відповіді незмінний: `{ data }` або `{ data, meta }` для списків; помилки — `AppException` + `ErrorCodes`.
4. Новий `errorCode` (SCREAMING_SNAKE_CASE) — одразу з перекладом у локалі фронту.

## 2. Модуль `apps/api/src/modules/<feature>/`

```
<feature>.module.ts
<feature>.controller.ts   — тонкий: валідація (ZodValidationPipe), виклик сервісу, формат
<feature>.service.ts      — бізнес-логіка, транзакції, цифри (суми/середні рахує бекенд)
<feature>.repository.ts   — лише Prisma, без логіки; приймає tx?: Prisma.TransactionClient
dto/
```

Інший модуль — лише через його сервіс, ніколи напряму в чужий repository.

## 3. Безпека (перевір явно)

- Guard у одному `@UseGuards(...)`; користувач — `request.user.sub`.
- Кожен запит до даних фільтрується за `userId` з токена. Є `:id` — сервіс перевіряє, що сутність належить користувачу (IDOR).
- Soft delete: фільтр `deletedAt: null` для записів користувача.
- Мутуючий або auth-ендпоінт — `@nestjs/throttler`.
- Явна обробка `null` від Prisma.
- Логи — `Logger` з контекстом, лише ідентифікатори; ніколи тіло, вага, їжа, токени.

## 4. Тести

- Unit на сервіс: головний сценарій + щонайменше один край (порожньо, чужий `id`, `null`).
- e2e на реальній БД: 2xx, 401 без токена, 404/403 на чужий ресурс, 422 на невалідне тіло.

## 5. Документація

Новий модуль чи модель — рядок у `docs/architecture.md` / `docs/database.md`.

## Готово, коли

- [ ] схеми в shared, контракт `{ data }`, коди помилок з перекладом
- [ ] module/controller/service/repository/dto; cross-module лише через сервіси
- [ ] userId-ізоляція й throttler перевірені тестом
- [ ] unit + e2e зелені; `pnpm lint && pnpm typecheck && pnpm test`; звіт за `/verify`
