# Кусь

AI-трекер харчування через чат. Пишеш або фотографуєш, що з'їв, а AI розбирає це на записи з калоріями й макросами, перепитує, коли не впевнений, і запам'ятовує звичні продукти. Mobile-first PWA.

> Статус: етап 0, каркас монорепо. Бізнес-логіки ще немає.

## Стек

| Частина           | Технології                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `apps/web`        | React 19, Vite, Tailwind CSS v4, TanStack Query, React Router, react-i18next, Feature-Sliced Design |
| `apps/api`        | NestJS 11, Prisma 7 (`PrismaPg`), PostgreSQL, zod (`nestjs-zod`), helmet                            |
| `packages/shared` | zod-схеми й типи, спільні для фронту й бекенду; промпт і AI-інструменти                             |
| Інструменти       | pnpm workspaces, TypeScript strict, ESLint (flat) + Prettier, Husky + lint-staged, Vitest           |
| Деплой            | api + PostgreSQL на Railway, web на Vercel, помилки в Sentry                                        |

Правила розробки: [CLAUDE.md](CLAUDE.md).

## Локальний запуск

Потрібні Node 22 (`nvm use`), pnpm 10 (`corepack enable`) і Docker Desktop.

```bash
pnpm install                        # також збирає packages/shared і генерує Prisma Client

pnpm db:up                          # PostgreSQL 17 у Docker на localhost:5434

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# заповни OPENROUTER_API_KEY і AI_MODEL в apps/api/.env; DATABASE_URL уже вказує на локальну базу

pnpm dev                            # api на :3000, web на :5173
```

Відкрий http://localhost:5173: сторінка «Чат» показує статус `GET /api/v1/health`.

### Локальна база

База описана в `docker-compose.yml`: контейнер `kus-db`, користувач, пароль і база `kus`, порт `5434` на хості (5432 і 5433 часто зайняті іншими локальними PostgreSQL). Дані зберігаються у volume `kus-pgdata` і переживають `db:down` та перезапуск Docker.

```bash
pnpm db:up       # підняти базу
pnpm db:down     # зупинити (дані зберігаються)
pnpm db:logs     # логи PostgreSQL
pnpm db:reset    # видалити контейнер і volume, підняти чисту базу
```

> ⚠️ `pnpm db:reset` **безповоротно стирає всі дані** локальної бази. Після нього застосуй міграції заново: `pnpm --filter @kus/api prisma migrate dev`.

## Команди

```bash
pnpm dev                                # api + web (+ watch для shared)
pnpm build                              # збірка всіх пакетів
pnpm lint && pnpm typecheck && pnpm test
pnpm format                             # prettier на весь репозиторій
pnpm db:up / db:down / db:logs          # локальна PostgreSQL у Docker
pnpm db:reset                           # ⚠️ стирає всі дані локальної бази
pnpm --filter @kus/api prisma migrate dev
```

## Структура

```
apps/
  api/        NestJS: config, prisma, common, modules/*
  web/        React: app, pages, widgets, features, entities, shared
packages/
  shared/     zod-схеми, типи, AI-промпт і інструменти
```
