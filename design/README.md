# Kusik — дизайн для реалізації

Чат-перший трекер харчування (PWA). Пишеш, що їв, звичайними словами, Kusik рахує калорії й БЖВ.
Цей архів — усе, що треба, щоб перенести дизайн у код і нічого не загубити.

> Покласти в репозиторій як `design/` у корені. Нічого звідси не імпортується «як є» в прод,
> крім `tokens/` і `src/` — решта це еталон, з яким звіряєшся.

## Що всередині

```
design/
├─ README.md               ← ти тут
├─ CLAUDE-design.md        ← правила для Claude Code (підключи з кореневого CLAUDE.md)
├─ tokens/
│  ├─ tokens.json          ← джерело правди: кольори, шрифт, радіуси, тіні, рух + коли що вживати
│  ├─ tokens.css           ← ті самі значення як CSS-змінні --k-*
│  └─ tailwind.preset.js   ← preset для Tailwind, що читає --k-* змінні
├─ docs/
│  ├─ screens.md           ← маршрут → екран → стани → файл макета
│  ├─ components.md        ← список компонентів з розмірами й станами
│  ├─ brand.md             ← назва, лого, хом'як, голос і тон, рішення
│  ├─ motion.md            ← анімації: тривалості, криві, що де рухається
│  └─ sounds.md            ← звуки й вібрація: коли грає, коли мовчить
├─ mockups/                ← 48 HTML-макетів, відкриваються в браузері без сервера
├─ screenshots/            ← PNG тих самих макетів (зручно кидати в чат з Claude Code)
├─ interactive/
│  ├─ motion.html          ← живе демо всіх анімацій (є режим «уповільнити ×3»)
│  └─ sounds.html          ← прослухати всі звуки
├─ src/                    ← готовий код, копіюй у frontend/src
│  ├─ brand/Logo.tsx, Loader.tsx, loader.css
│  ├─ hamster/Hamster.tsx, hamster.css   ← 12 настроїв + голова для чату
│  ├─ sound/sounds.ts      ← Web Audio синтез, 10 звуків, без файлів
│  └─ motion/motion.ts, motion.css       ← хелпери WAAPI + частинки успіху
└─ assets/                 ← SVG/PNG: лого, favicon, іконки PWA 192/512/maskable, apple-touch
```

## Як підключити (React + Vite + Tailwind)

1. Скопіюй `design/` у корінь репозиторію.
2. `frontend/src/main.css`:
   ```css
   @import "../../design/tokens/tokens.css";
   @import "../../design/src/motion/motion.css";
   ```
3. `tailwind.config.js`:
   ```js
   presets: [require('../design/tokens/tailwind.preset.js')],
   ```
4. Шрифт Manrope: `npm i @fontsource/manrope` і в `main.tsx`
   `import '@fontsource/manrope/500.css'; …/600.css; …/700.css; …/800.css;` (без Google Fonts — швидше й офлайн для PWA).
5. Скопіюй `design/src/*` у `frontend/src/design/` (або налаштуй alias `@design`).
6. Іконки з `assets/` — у `frontend/public/`, і в `manifest.webmanifest`:
   ```json
   "icons": [
     { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
     { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
     { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
   ],
   "theme_color": "#FBF6EE", "background_color": "#FBF6EE"
   ```
7. У кореневий `CLAUDE.md` додай рядок: `Дизайн: дотримуйся design/CLAUDE-design.md`.

## Порядок реалізації (рекомендований)

1. Токени + шрифт + `AppShell` (градієнтне тло, safe-area, нижня панель).
2. Базові компоненти з `docs/components.md`: Button, Field, Chip, Toggle, Sheet, Loader, Logo, Hamster.
3. Чат: бульбашки, картка страви, поле вводу. Це серце продукту.
4. Онбординг (4 кроки + план) → Сьогодні → Прогрес → Рецепти → Профіль/Налаштування/Пам'ять.
5. Авторизація (7 екранів).
6. Рух і звуки — коли екрани вже стоять. `motion.ts` і `sounds.ts` готові.
7. Лендинг — **окрема статична сторінка** (SEO), не частина SPA. Застосунок живе на `/app`.

## Як перевіряти, що «як у макеті»

- Відкрий `mockups/<екран>.html` поруч із застосунком у DevTools на 390×844.
- Або дай Claude Code скриншот з `screenshots/` і скажи: «порівняй з моїм екраном, перелічи розбіжності в px і кольорах».
- Числа в макетах узгоджені між собою (2 200 ккал, Б 140 / В 225 / Ж 80, вага 84 → 78 кг, зараз 82,4) — використовуй їх як сід-дані для розробки.

## Чого тут свідомо немає

- Темної теми (відкладено). Не додавай `dark:` класи, поки не буде макетів.
- Вигаданих пунктів меню чи фіч. Якщо екрану немає в `docs/screens.md` — його не робимо.
- Домену. Робоча назва домену в макетах відсутня; рекомендовано `kusik.app`.

`archive-palettes.html` — історія вибору палітри (м'ятна vs «Хом'як»). Не для реалізації.
