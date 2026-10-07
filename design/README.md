# Kusik — дизайн для реалізації

Чат-перший трекер харчування (PWA). Пишеш, що їв, звичайними словами — Kusik рахує калорії й БЖВ.
Цей архів — усе, щоб перенести дизайн у код і нічого не загубити.

> Поклади в корінь монорепо як `design/`. Сюди дивляться як на еталон;
> у `apps/web` копіюються лише `tokens/theme.css`, `src/*` і `assets/*` (куди саме — таблиця в `CLAUDE-design.md`).

## Що всередині

```
design/
├─ README.md               ← ти тут
├─ CLAUDE-design.md        ← правила дизайну для Claude Code (на нього посилається кореневий CLAUDE.md)
├─ CHANGELOG.md            ← журнал дизайн-рішень: що й чому змінено (нове — зверху)
├─ tokens/
│  ├─ theme.css            ← Tailwind v4 @theme: кольори, шрифт, радіуси, тіні, криві, тривалості, градієнти
│  └─ tokens.json          ← ті самі значення + коли що вживати
├─ docs/
│  ├─ screens.md           ← маршрут → екран → стани → файл макета + сід-дані
│  ├─ components.md        ← компоненти з розмірами й станами
│  ├─ brand.md             ← назва, лого, хом'як, палітра, голос і тон, ухвалені рішення
│  ├─ motion.md            ← рух: тривалості, криві, що де рухається, 3 рівні успіху
│  ├─ sounds.md            ← звуки й вібрація: коли грає, коли мовчить
│  └─ food-categories.md   ← 45 категорій страв: список, zod/Prisma, текст для промпту AI
├─ mockups/                ← 52 HTML-макети, відкриваються в браузері без сервера
├─ screenshots/            ← PNG тих самих макетів (зручно давати Claude Code для порівняння)
├─ interactive/
│  ├─ motion.html          ← живе демо анімацій (є «уповільнити ×3»)
│  └─ sounds.html          ← прослухати всі звуки
├─ src/                    ← готовий код за правилами CLAUDE.md (стрілкові функції, без хардкоду рядків, Motion)
│  ├─ brand/               ← LogoMark, Logo, Loader, useDelayedFlag
│  ├─ hamster/             ← Hamster (12 настроїв), HamsterHead (8 виразів для чату, 1:1 з макетів)
│  ├─ motion/              ← токени й варіанти Motion, countUp, fillArc, частинки успіху, useBlink
│  ├─ sound/               ← playSound: 10 звуків Web Audio, без файлів
│  ├─ icon/                ← Icon: 51 іконка інтерфейсу (svg/ → icon.generated.tsx), ProgressRingIcon
│  ├─ food/                ← FoodIcon: 45 іконок страв (svg/ → food-icons.generated.tsx), getMealCategory
│  ├─ i18n/uk.json         ← рядки, які потрібні цим компонентам
│  └─ lib/cx.ts            ← тимчасовий cx(); при перенесенні заміни на cn()
├─ scripts/build-icons.mjs  ← генератор: SVG → типізований TSX + сторінка-перегляд (без залежностей)
└─ assets/                 ← SVG-лого (кольорове, без літери, mono, горизонтальне), favicon, іконки PWA 192/512/maskable, apple-touch
```

Код перевірений: `tsc --strict` без помилок, компоненти відрендерені в браузері, пакет `motion` (перевірено на версії 14).

## Підключення (apps/web)

1. `tokens/theme.css` → `apps/web/src/shared/ui/theme/tokens.css`, у глобальних стилях:
   ```css
   @import "tailwindcss";
   @import "./shared/ui/theme/tokens.css";
   ```
   Класи з'являються самі: `bg-primary`, `text-muted`, `rounded-card`, `shadow-card`, `ease-spring`, `bg-app`.
2. Шрифт: `pnpm --filter web add @fontsource/manrope` і в `main.tsx` — `@fontsource/manrope/{500,600,700,800}.css`.
3. `src/*` → у `shared/ui` і `shared/lib` за таблицею з `CLAUDE-design.md`; `cx` → `cn`.
4. Залежності для коду: `motion` (вже у стеку). Іконки, звук і хом'як — без залежностей; Phosphor зі стеку прибрати.
5. Рядки з `src/i18n/uk.json` — злити в локаль `uk`.
6. `assets/*.png`, `favicon.svg` → `apps/web/public/`; у `vite-plugin-pwa`:
   ```ts
   icons: [
     { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
     { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
     { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
   ],
   theme_color: '#FBF6EE', background_color: '#FBF6EE',
   ```
7. У корені застосунку: `<MotionConfig reducedMotion="user">`.
8. Іконки: `scripts/build-icons.mjs` → `apps/web/scripts/`, у `PACKS` поправ шляхи на `../src/shared/ui/icon/…` і `../src/shared/ui/food-icon/…`,
   у `apps/web/package.json` → `"icons": "node scripts/build-icons.mjs"`. Запуск: `pnpm --filter web icons`.
   Згенеровані `*.generated.tsx` і `*.preview.html` комітяться; додай їх у ignores ESLint/Prettier, бо їх пише скрипт.
9. Скіли: тека `.claude/skills/` з архіву скілів → у корінь репозиторію (поруч із `verify`).

## Як перевіряти «як у макеті»

- Відкрий `mockups/<екран>.html` поруч із застосунком у DevTools на 390×844.
- Або дай Claude Code `screenshots/<екран>.png` і скриншот свого екрана: «перелічи розбіжності в px, кольорах і текстах».
- Числа в макетах узгоджені між собою (2 200 ккал, Б 140 / В 225 / Ж 80, вага 84 → 78 кг, зараз 82,4) — бери їх як сід-дані.

## Чого тут свідомо немає

- Темної теми (відкладено).
- Сторінок політики конфіденційності й умов — це текст у стилі лендингу, окремого макета не треба.
- Екрана дозволу на push — потрібен, лише якщо нагадування будуть у першій версії.

`archive-palettes.html` — історія вибору палітри (м'ятна vs «Хом'як»). Не для реалізації.
