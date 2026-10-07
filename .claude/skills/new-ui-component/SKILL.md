---
name: new-ui-component
description: Створити новий UI-компонент Kusik (базовий Рівня 0 у shared/ui або предметний у entities/features) з типами, варіантами cva і a11y. Використовуй, коли той самий шматок інтерфейсу потрібен у 2+ місцях.
---

# Новий UI-компонент

Правила коду — `CLAUDE.md` (розділи 3, 4, 7, 13). Вигляд — `design/docs/components.md` і макети.

## 0. Перевір, що його ще немає

Рівень 0: `Surface`, `Text`, `Heading`, `Button`, `IconButton`, `Input`, `Chip`, `Badge`, `Spinner` (= `Loader`), `Skeleton`, `BaseBottomSheet`, `BaseModal`, `FormField`, `AppLayout`, `BottomNav`.
Плюс бренд: `Icon`, `FoodIcon`, `Hamster`, `HamsterHead`, `Logo`. Часто вистачає нового варіанта в наявному.

## 1. Де

- Базовий, без знання про домен → `apps/web/src/shared/ui/<name>/`.
- Знає про їжу/записи/рецепти → у своєму `entities/<x>/ui/` або `features/<x>/ui/`.

## 2. Файли (папка kebab-case)

```
<name>/
  <Name>.tsx              — лише JSX + виклик хуків
  <name>.types.ts         — пропси
  <name>.variants.ts      — cva (якщо є варіанти)
  index.ts                — barrel
```

## 3. Правила

- Стрілкові функції, без `forwardRef` (React 19 — `ref` як проп), без `any`.
- Вигляд — лише токени через класи; варіанти — `cva`; злиття — `cn()`. Inline `style` — лише для динамічних значень.
- Розміри з `components.md`: тап ≥ 44, кнопка 48, текст ≥ 12.
- Є Radix primitive для поведінки — бери його, стилі наші.
- Рядків UI в компоненті немає — тексти приходять пропсами або через `t()` у сторінці.
- Іконкова кнопка без тексту — обов'язковий `aria-label`. Фокус видно.
- Рух — пресети з `shared/lib/motion` (`PRESS`, `TRANSITION`).

## 4. Перевірка

Відрендер усі варіанти й стани (default, hover/active, disabled, loading, error) на одній сторінці або в тесті, зроби скриншот і порівняй з макетом.

## Готово, коли

- [ ] не дублює наявний; лежить у правильному шарі; barrel
- [ ] варіанти через cva, лише токени, a11y
- [ ] скриншот станів; lint і typecheck зелені; звіт за `/verify`
