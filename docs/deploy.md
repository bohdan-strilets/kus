# Деплой «Кусь»

Як підняти прод з нуля, задеплоїти зміни з міграцією й відновити базу. Чому саме так (секрет шлюзу, IP клієнта, CSP, таймаути) — [`architecture.md`](architecture.md#web--api-один-origin-через-rewrite).

## Прод

| Що       | Де                                                                    |
| -------- | --------------------------------------------------------------------- |
| Web      | https://kus-psi.vercel.app (Vercel, `apps/web`)                       |
| API      | https://kusapi-production.up.railway.app (Railway, сервіс `@kus/api`) |
| База     | PostgreSQL на Railway, лише приватна мережа                           |
| Ланцюжок | телефон → Vercel (`/api/*` rewrite + секрет) → edge Railway → NestJS  |

Браузер ходить лише на домен Vercel. Прямий запит на домен Railway без секретного заголовка отримує `404` (крім `/api/v1/health`).

## Railway

Налаштування тримаємо **в UI Railway**, не в репо: config as code (`railway.json` / `railway.toml`) deprecated і працює до 2026-12-01. Поле «Config file path» у сервісі лишаємо порожнім.

### Проєкт і база

1. New Project → регіон **EU West (Amsterdam)** — найближче до Польщі. Той самий регіон для обох сервісів.
2. Add → Database → **PostgreSQL**. Public Networking (TCP proxy) — **вимкнено**: API ходить у базу приватною мережею.

### Сервіс `@kus/api`

Add → GitHub Repo → цей репозиторій, гілка `main`.

| Налаштування        | Значення                                                                      |
| ------------------- | ----------------------------------------------------------------------------- |
| Root Directory      | порожньо (корінь репо: потрібен workspace `packages/shared`)                  |
| Config file path    | порожньо                                                                      |
| Build Command       | `pnpm install --frozen-lockfile --prod=false && pnpm --filter @kus/api build` |
| Pre-deploy Command  | `pnpm --filter @kus/api exec prisma migrate deploy`                           |
| Start Command       | `pnpm --filter @kus/api start`                                                |
| Healthcheck Path    | `/api/v1/health`                                                              |
| Healthcheck Timeout | `60`                                                                          |
| Restart Policy      | On Failure                                                                    |
| Watch Paths         | `apps/api/**`, `packages/shared/**`, `pnpm-lock.yaml`                         |
| Networking          | Generate Domain → `kusapi-production.up.railway.app`, порт — той, що в `PORT` |

- `--prod=false` обов'язковий: з `NODE_ENV=production` pnpm пропустив би devDependencies, а без них немає `nest build`, `prisma` і `dotenv` для `prisma.config.ts`.
- `postinstall` у корені сам збирає `packages/shared` і генерує Prisma Client.
- Pre-deploy виконується між збіркою й запуском, має доступ до змінних і приватної мережі. Якщо він падає, деплой зупиняється, а стара версія далі обслуговує запити.
- Healthcheck робить `SELECT 1`: без бази він повертає `503`, і такий деплой не стає живим.
- Node 22 береться з `.nvmrc` / `engines`.

### Змінні сервісу `@kus/api`

Значення секретів не пишемо ні в репо, ні в чат. Генерація секрету: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

| Змінна                              | Значення                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `NODE_ENV`                          | `production` — вмикає `Secure`-cookie і робить `API_PROXY_SECRET` обов'язковим |
| `DATABASE_URL`                      | посилання `${{Postgres.DATABASE_URL}}` (приватна адреса)                       |
| `CORS_ORIGIN`                       | `https://kus-psi.vercel.app`                                                   |
| `OPENROUTER_API_KEY`                | 🔒 ключ OpenRouter                                                             |
| `AI_MODEL`                          | `anthropic/claude-sonnet-5.5`                                                  |
| `JWT_ACCESS_SECRET`                 | 🔒 ≥ 32 символи                                                                |
| `API_PROXY_SECRET`                  | 🔒 ≥ 32 символи, **те саме значення, що у Vercel**                             |
| `ALLOW_REGISTRATION`                | `false` (на `true` — лише на час створення власного акаунта)                   |
| `AI_TIMEOUT_MS`                     | не задавати (45 000; максимум 95 000)                                          |
| `AI_DAILY_MESSAGE_LIMIT`            | не задавати (100)                                                              |
| `AI_MODEL_VISION` / `AI_MODEL_CHAT` | не задавати (= `AI_MODEL`)                                                     |
| `STORAGE_PROVIDER`                  | `s3` — у production без цього сервер не стартує                                |
| `S3_ENDPOINT`                       | `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com` (без назви бакета)          |
| `S3_REGION`                         | `auto`                                                                         |
| `S3_ACCESS_KEY_ID`                  | 🔒 ключ R2-токена                                                              |
| `S3_SECRET_ACCESS_KEY`              | 🔒 секрет R2-токена                                                            |
| `S3_BUCKET`                         | назва prod-бакета                                                              |
| `STORAGE_KEY_PREFIX`                | `prod` — префікс ключів файлів                                                 |
| `PHOTOS_PER_MESSAGE_MAX`            | `1` (6 — лише коли з'явиться B2); не більше 6                                  |
| `PHOTO_DAILY_UPLOAD_LIMIT`          | `60` — завантажень фото на користувача за день                                 |
| `AI_DAILY_PHOTO_LIMIT`              | `30` — фото, надісланих моделі, на користувача за день                         |
| `PHOTO_ORPHAN_TTL_HOURS`            | `24` — через скільки годин крон видаляє фото без повідомлення                  |
| `COOKIE_DOMAIN`                     | **не задавати** — cookie host-only на домені Vercel                            |
| `PORT`                              | не задавати — Railway підставляє сам                                           |

Невалідний або відсутній обов'язковий env → сервер не стартує, у логах — помилка валідації zod з назвою змінної.

## Vercel

New Project → цей репозиторій.

| Налаштування     | Значення                                                            |
| ---------------- | ------------------------------------------------------------------- |
| Root Directory   | `apps/web`                                                          |
| Framework Preset | Vite (збірка й output — за замовчуванням, `dist`)                   |
| Install          | за замовчуванням (pnpm workspace з кореня)                          |
| Змінні           | `API_PROXY_SECRET` 🔒 — Production і Preview, те саме, що в Railway |

`apps/web/vercel.json` задає все інше: проксі `/api/*` на домен Railway з заголовком `x-kus-proxy-secret` (значення — зі змінної, у git його немає), CSP та інші заголовки безпеки, `immutable` для `/assets/*`, `no-cache` для оболонки й service worker, 404 для відсутніх файлів `/assets`, SPA-fallback.

- Секрет вставляти **без пробілів і переносу рядка**: Vercel передає значення як є, і будь-яка різниця з Railway дає `404` на всьому API.
- Новий домен Railway → поміняти `dest` у `vercel.json` (окремий коміт).
- Preview-деплої ходять у той самий продакшн API: гілка з поламаним фронтом працює з живими даними.

## Перший запуск з нуля

1. Railway: проєкт, Postgres, сервіс `@kus/api` з налаштуваннями й змінними вище. `ALLOW_REGISTRATION=true`.
2. Дочекатися деплою: у логах pre-deploy — застосовані міграції, далі `API listening on port …`.
3. Перевірити напряму:
   - `curl https://kusapi-production.up.railway.app/api/v1/health` → `{"data":{"status":"ok"}}`;
   - `curl https://kusapi-production.up.railway.app/api/v1/users/me` → `404` (шлюз працює).
4. Vercel: проєкт, Root `apps/web`, `API_PROXY_SECRET` → деплой.
5. З телефона: зареєструвати власний акаунт на домені Vercel.
6. Railway: `ALLOW_REGISTRATION=false` → redeploy. Перевірка: реєстрація повертає відмову.
7. Smoke-тест (нижче).

## Деплой змін

Звичайна зміна: push у `main` → Railway збирає `@kus/api`, якщо зачеплено watch paths, а Vercel збирає web.

### Зміна з міграцією

1. Локально: `pnpm --filter api prisma migrate dev --name <що_змінилось>` → закомітити теку `apps/api/prisma/migrations/<дата>_<назва>/` разом з кодом.
2. Міграція має бути сумісна зі старим кодом: між pre-deploy і перемиканням старий API ще працює на новій схемі. Видалення чи перейменування колонки — у два деплої (спершу код перестає її читати, потім міграція її прибирає).
3. Перед push — визначити тип міграції. Лише **додає** (нові таблиці, колонки, індекси, nullable-поля) — без бекапу. **Видаляє або переписує** дані (`DROP`, зміна типу, `UPDATE` наявних рядків, `NOT NULL` на заповнену колонку) — один дамп за розділом «Дамп перед руйнівною міграцією»; репетиція на копії бази — лише в цьому випадку.
4. Push → збірка → pre-deploy `prisma migrate deploy` → healthcheck → нова версія.
5. Перевірити, що міграції застосовані (нижче).

### Реліз із сховищем фото (0.6.0)

Міграція `20261015120000_add_stored_files` додає `stored_files` і видаляє колонку `message_attachments.storage_key`. Файли тепер живуть у S3-сумісному сховищі, не в базі.

1. **Бакет Cloudflare R2.** Створити бакет з юрисдикцією **EU**; окремі бакети для prod і dev. API-токен — права **Object Read & Write** лише на цей бакет. Endpoint для EU-юрисдикції має вигляд `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_BUCKET` — назва бакета.
2. **Змінні Railway** — з таблиці «Змінні сервісу `@kus/api`» вище (`STORAGE_PROVIDER`, `S3_*`, `STORAGE_KEY_PREFIX`, `PHOTOS_PER_MESSAGE_MAX`, `PHOTO_DAILY_UPLOAD_LIMIT`, `AI_DAILY_PHOTO_LIMIT`, `PHOTO_ORPHAN_TTL_HOURS`). Секрети не пишемо ні в репо, ні в чат.
3. **Деплой API** (push у `main` після `security-audit`): pre-deploy застосовує міграцію, healthcheck → нова версія.
4. **Smoke сховища.** Проти **dev**-бакета, не prod: `S3_*` у `apps/api/.env`, потім `pnpm --filter api test:smoke:storage`.
5. **Реальне завантаження** фото ≈ 2 МБ через домен Vercel (rewrite) після деплою API, до оголошення релізу.
6. **iPhone PWA** — кроки з чекліста деплою A.

**Відкат.** Файли в бакеті лишаються, а колонку `storage_key` міграція видалила, тому код попередньої версії працювати не буде. Відкат — лише відновленням з дампу (див. «Відновлення з дампу»).

### Як перевірити, що міграції застосовані

- **Логи деплою → Pre-deploy**: `All migrations have been successfully applied` або `No pending migrations to apply`.
- **Railway CLI** (`railway link` до проєкту, сервіс `@kus/api`):
  ```bash
  railway ssh -- pnpm --filter @kus/api exec prisma migrate status
  ```
  Очікується `Database schema is up to date!`.
- **Railway → Postgres → Data → `_prisma_migrations`**: у кожного рядка заповнений `finished_at`, а `rolled_back_at` порожній. Останній рядок — тека з останнього коміту.

Симптом незастосованих міграцій — `P2021` («table … does not exist») у логах API і `500` на запитах. Так було на першому деплої, бо pre-deploy не виконувався.

### Міграція впала

- Деплой зупинився на pre-deploy, стара версія працює далі. Помилка — в логах pre-deploy.
- Міграцію, що застосувалась наполовину, Prisma позначає як невдалу (`P3009` на наступному `migrate deploy`). Виправити дані чи схему вручну, потім:
  ```bash
  railway ssh -- pnpm --filter @kus/api exec prisma migrate resolve --rolled-back <тека_міграції>
  ```
  і задеплоїти виправлену міграцію. Якщо щось зіпсовано — відновити дамп (див. «Відновлення з дампу»).

#### Якщо міграція впала на запобіжнику

Деякі міграції починаються з `DO`-блоку з `RAISE EXCEPTION`: він відмовляється видаляти дані, яких ми не скопіювали (так влаштована `drop_weight_entries`). Тоді pre-deploy падає з `P3018` і текстом запобіжника, Railway лишає попередню версію, а таблиця й дані на місці.

1. Прочитати текст помилки в логах pre-deploy: він каже, яких даних бракує.
2. Знайти причину в базі й виправити дані (наприклад, додати відсутній рядок у цільову таблицю) або прибрати зайвий рядок. Дамп перед деплоєм має бути зроблений.
3. Позначити міграцію відкоченою: `railway ssh -- pnpm --filter @kus/api exec prisma migrate resolve --rolled-back "<назва_теки_міграції>"`.
4. Повторити deploy (redeploy того самого коміту).

На проді це робить Богдан: Claude Code доступу до прод-бази немає.

## Перевірка після деплою

- `GET /api/v1/health` напряму на Railway → `200`; будь-який інший шлях напряму → `404`.
- Вхід з Wi-Fi і з мобільного інтернету не ділить ліміт входу (5/хв). Якщо в логах API з'явилось `x-vercel-forwarded-for is missing behind the proxy` — Vercel не передав IP клієнта, усі ділять один ліміт (див. `architecture.md`).
- Smoke-тест з телефона:
  1. Вхід → чат відкривається, шапка з датою й кільцем.
  2. «3 варені яйця і 100 г гречки» → картка, суми, уточнення «варена / суха».
  3. Тап по варіанту → значення оновились, кільце змінилось.
  4. «зміни гречку на 150 г» → «· змінено», бейдж перераховано.
  5. «Сьогодні» → прийоми, кільце й тиждень такі самі, як у чаті.
  6. «На екран Додому» → відкрити, перезапустити.
  7. Вихід → `/login`, «Назад» не повертає в чат.
- Логи Railway: лише ідентифікатори (`userId`, `messageId`), без тексту повідомлень, email і їжі.

## Перевірка на iPhone

Після змін каркаса, полів вводу чи PWA-налаштувань — на справжньому телефоні, у Safari і в PWA з «Екрана Додому». Playwright цього не замінює: клавіатуру iOS, свайп назад і статус-бар він не емулює.

**Статус-бар (PWA).** `apple-mobile-web-app-status-bar-style` — `default`: застосунок починається під статус-баром, годинник чорний. `theme-color` і `theme_color` у manifest — верх градієнта `#FCEBD8`.

- [ ] Якого кольору смуга статус-бару в PWA? Персикова — добре. Біла — прийнятно, лишаємо.
- [ ] Годинник і батарея не накладаються на «kusik» і не зливаються з фоном.
- [ ] У Safari верхня панель браузера персикова, не біла.

**Прокрутка й фон**

- [ ] Свайп по шапці чату чи по нав-бару — сторінка не їде; прокручується лише стрічка.
- [ ] На «Сьогодні» прокручується вміст вкладки; шапка дня й нав-бар на місці.
- [ ] Ривок за край (вгору й вниз) не відкриває білого — лише персиковий фон.
- [ ] Під нав-баром немає зайвого порожнього місця: він стоїть над смужкою «Додому».

**Поля вводу (без зуму)**

- [ ] Тап у поле чату — сторінка не збільшується.
- [ ] Те саме на `/login` (email, пароль), у формі цілі (sheet) і в профілі («Як до тебе звертатися?»).
- [ ] Зум двома пальцями все ще працює (його не вимкнено), а каркас під час зуму не стискається й не їде за пальцями.

**Клавіатура**

- [ ] Тап у поле чату: нав-бар ховається, поле стоїть одразу над клавіатурою, стрічка показує останнє повідомлення.
- [ ] Набрати й надіслати — відповідь видно над полем, клавіатура не закривається сама.
- [ ] Закрити клавіатуру (тап у стрічку чи «Готово»): нав-бар повертається, без білого зазору знизу, нічого не з'їхало.
- [ ] Повернути телефон у ландшафт і назад — каркас на місці.
- [ ] Поле в sheet цілі (тап по кільцю → «Змінити ціль»): кнопка «Зберегти» видна над клавіатурою або до неї можна прокрутити.

**Чернетка**

- [ ] Почати писати, перейти на «Сьогодні» й назад — текст на місці.
- [ ] Закрити PWA (змахнути з перемикача), відкрити — текст на місці.
- [ ] Надіслати — поле порожнє. Вийти й увійти — поле порожнє.

**Вихід**

- [ ] Профіль → «Вийти» → `/login`.
- [ ] Свайп від лівого краю (і «Назад» у Safari) — лише сторінки входу, ані чату, ані даних навіть на мить під час жесту.
- [ ] Те саме після перезавантаження посеред сесії (потягнути вниз / кнопка оновлення в Safari), а потім вихід; свайп уперед теж не показує чат.

**Напої**

- [ ] «склянка соку» → «250 мл», «пляшка пива» → «500 мл», «чашка кави з молоком» → «… мл»; йогурт і суп — у грамах.
- [ ] Той самий напій на «Сьогодні» й у варіантах уточнення ніде не показаний як «г».

## Дамп перед руйнівною міграцією

Лише перед міграцією, що видаляє або переписує дані. Бекапів Railway (Postgres → Backups) на Hobby немає, тож один логічний дамп на свій диск. Ніколи не в репо: там раціон і вага (RODO, репозиторій публічний). `pg_dump` локально не встановлений, тож через Docker (`postgres:18` — версія клієнта має бути не нижча за серверну). Перевірена послідовність на Windows / PowerShell:

1. **Відкрити проксі.** Railway → Postgres → **Settings → Networking → TCP Proxy** → увімкнути → **Deploy**: зміни налаштувань стають у чергу «Apply changes» і діють лише після Deploy. `DATABASE_PUBLIC_URL` з'являється у Variables тільки після цього.
2. **Дамп у теку поза репо** (наприклад `$HOME\kus-backups`). URL — лише через змінну оточення, яку вводиш через `Read-Host`: так він не лишається ні в команді, ні в історії PowerShell:
   ```powershell
   New-Item -ItemType Directory -Force "$HOME\kus-backups"
   $env:DB_URL = Read-Host 'DATABASE_PUBLIC_URL'
   docker run --rm -v "$HOME\kus-backups:/backup" postgres:18 pg_dump "$env:DB_URL" -Fc --no-owner -f /backup/kus-<дата>.dump
   Get-ChildItem "$HOME\kus-backups"
   Remove-Item Env:DB_URL
   ```
   `Get-ChildItem` має показати файл з розміром явно більшим за кілька кілобайт; порожній або крихітний дамп означає, що з'єднання не відбулось.
3. **Одразу закрити проксі.** Postgres → Settings → Networking → видалити TCP Proxy → знову **Deploy**. Без цього база лишається доступна з інтернету за паролем.

У Git Bash той самий `docker run` із `-v /c/Users/<user>/kus-backups:/backup` і `PGURL` з `export`/`unset`; суть та сама — URL не в історії, проксі лише на час дампу.

### Відновлення з дампу

1. Створити новий сервіс PostgreSQL у тому ж проєкті й регіоні.
2. Тимчасово увімкнути йому TCP proxy → `pg_restore --no-owner --dbname "<його публічний DATABASE_URL>" kus-<дата>.dump` → вимкнути TCP proxy.
3. У сервісі `@kus/api` змінити `DATABASE_URL` на посилання на нову базу → redeploy. Pre-deploy докатить міграції, новіші за дамп.
4. Перевірити `migrate status` і smoke-тест.

## Секрети

- **`API_PROXY_SECRET`**: змінити у Vercel і Railway → redeploy обох. Між двома деплоями API відповідає `404`.
- **`JWT_ACCESS_SECRET`**: змінити в Railway → redeploy. Чинні access-токени стануть недійсними; тихий refresh видасть нові, тож вхід заново не потрібен.
- **`OPENROUTER_API_KEY`**: новий ключ в OpenRouter → змінна в Railway → redeploy → старий ключ відкликати.

## Відомі вразливості залежностей

Стан `pnpm audit` на 2026-10-13: усі знахідки приходять через devDependency `prisma@7.10.0` (`apps/api`), у рантайм API не потрапляють.

- **`deepmerge-ts@7.1.5`, GHSA-ggr8-5vv4-36mx (high) — прийнятий ризик.** Шлях: `prisma` → `@prisma/config` → `deepmerge-ts`. Використовується лише CLI (`prisma.config.ts` під час `migrate` / `generate`); API працює через `PrismaPg`-адаптер, а `@prisma/client` від `@prisma/config` не залежить, тож у рантайм він не завантажується. Виправлення (≥ 8.0.0) недоступне: `@prisma/config` 7.10 тягне 7.x, тому override не ставимо. Перевірити при кожному оновленні Prisma.
- **`mysql2`, GHSA-3f6p-5ww8-9rcr (high) і GHSA-rgwj-5xj2-c3m3 (moderate) — закрито.** `prisma` тягне `mysql2@3.15.3` для CLI/studio; у `pnpm-workspace.yaml` стоїть `overrides: mysql2: 3.23.1` (мінімальна версія з обома виправленнями). Override можна прибрати, коли Prisma сама оновить `mysql2` до ≥ 3.23.1.

## Типові збої

| Симптом                                         | Причина                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `502 Application failed to respond` від Railway | сервер не стартував (env, збірка) або слухає не той порт — логи деплою |
| `P2021` у логах, `500` на запитах               | міграції не застосовані: pre-deploy не налаштований чи впав            |
| `404` на всьому API через Vercel                | `API_PROXY_SECRET` у Vercel і Railway відрізняються (пробіл, перенос)  |
| Деплой не стає живим, healthcheck `503`         | API не дістається бази: `DATABASE_URL`, стан Postgres                  |
| Усі ділять один ліміт входу                     | немає `x-vercel-forwarded-for` за проксі — warn у логах API            |
