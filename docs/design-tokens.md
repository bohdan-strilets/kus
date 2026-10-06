# Design tokens: what we added on top of `design/`

The source of truth is `design/tokens/tokens.json` (read-only). The code uses
`apps/web/src/shared/ui/theme/tokens.css`, a 1:1 port to Tailwind v4 `@theme`. This page lists
every token that exists in code but **not** in `design/tokens`, and why it was added.

Rule (stage 1 decision): a value that repeats across `design/mockups` becomes a token. A value
used only once is rounded to the nearest existing token. Mockups win over `tokens.json`, and
`tokens.json` wins over `docs/*.md` (`design/CLAUDE-design.md`).

## Added tokens

| Token                                             | Value                             | Where it comes from                                                     | Why                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color-muted-soft`                                | `#A8998A`                         | `today` (disabled «next day» arrow), docs Charts (goal dashed line)     | Used in several places, not in tokens                                                                                                                                                                                                                                                                     |
| `color-line-strong`                               | `#DCCBB9`                         | `today`, the dashed «Вечеря» suggestion card                            | Stronger border than `line`                                                                                                                                                                                                                                                                               |
| `color-track`                                     | `#EFE6DC`                         | the calorie gauge track in `chat`, `today`, `brand-calorie-ring-states` | Mockups use it instead of `divider` `#F0E9E0`                                                                                                                                                                                                                                                             |
| `color-handle`                                    | `#E2D6C9`                         | docs Sheet: the 40×5 grabber                                            | Not in tokens                                                                                                                                                                                                                                                                                             |
| `color-toggle-off`                                | `#DDCFC0`                         | docs Toggle: the off state                                              | Not in tokens (also the future-day bar colour in docs Charts)                                                                                                                                                                                                                                             |
| `color-over-ink`                                  | `#AB4F19`                         | —                                                                       | **Contrast.** `over` is 4.40:1 on white and 3.77:1 on `bg-app`, so it fails AA for small text. `over-ink` is `over` darkened until it is ≥ 4.5:1 on `surface` and on every stop of `bg-app`. Text for over-goal numbers («+180», «ккал понад ціль») uses `over-ink`. `over` stays for arcs, dots and bars |
| `color-over-soft`                                 | `#F2A877`                         | docs Charts: over-goal bars in the weekly summary                       | Not in tokens                                                                                                                                                                                                                                                                                             |
| `radius-badge`                                    | 10px                              | `chat`: the kcal badge and the time divider                             | Repeats                                                                                                                                                                                                                                                                                                   |
| `radius-tile-sm`                                  | 14px                              | compact macro tiles in the chat header, meal icon tile, week strip day  | Repeats                                                                                                                                                                                                                                                                                                   |
| `radius-bubble-ai`                                | 22px                              | the Kusik bubble in `chat`, the week strip in `today`                   | docs say 20, mockups use 22                                                                                                                                                                                                                                                                               |
| `radius-panel`                                    | 26px                              | composer in `chat`, day card in `today`                                 | Repeats                                                                                                                                                                                                                                                                                                   |
| `radius-nav`                                      | 30px                              | the floating bottom nav                                                 | Repeats on every tab screen                                                                                                                                                                                                                                                                               |
| `shadow-float`                                    | `0 10px 28px rgb(80 50 20 / .12)` | bottom nav and composer                                                 | Like `card`, but .12                                                                                                                                                                                                                                                                                      |
| `shadow-field`                                    | `0 6px 16px rgb(80 50 20 / .06)`  | docs Field                                                              | Not in tokens                                                                                                                                                                                                                                                                                             |
| `text-wordmark`                                   | 22/800, −0.04em                   | `tokens.json` → `font.scale.wordmark`                                   | Present in json, missing in the Tailwind preset                                                                                                                                                                                                                                                           |
| `container-app`                                   | 480px                             | `CLAUDE-design.md` §15                                                  | Column width on wide screens                                                                                                                                                                                                                                                                              |
| `spacing-gutter`, `spacing-tap`, `spacing-button` | 16 / 44 / 48                      | Tailwind preset `spacing`                                               | Ported as is (`tap` instead of `touch`)                                                                                                                                                                                                                                                                   |

Surface transparencies from the mockups (0.45, 0.5, 0.6, 0.7, 0.82, 0.85, 0.94) are **not**
tokens: they are written with Tailwind's opacity modifier (`bg-surface/85`).

Durations (`fast` 120, `base` 200, `slow` 320) are plain `--duration-*` variables plus
`duration-fast|base|slow` utilities, because Tailwind v4 has no duration theme namespace. Under
`prefers-reduced-motion` they drop to 0. Motion presets with the same values live in
`shared/lib/motion` (`DURATION_MS`, `EASE`, `TRANSITION`).

## Contrast (WCAG 2.x)

Checked on 2026-10-06. Text needs ≥ 4.5:1 (AA), or 3:1 for large text (≥ 24px, or ≥ 18.66px bold).
UI parts (arcs, bars, borders) need ≥ 3:1.

| Text                      | Background                                   | Contrast                  |                                              |
| ------------------------- | -------------------------------------------- | ------------------------- | -------------------------------------------- |
| ink                       | surface / bg-app / secondary                 | 13.5–15.8                 | ✅                                           |
| muted                     | surface / bg-app / field / secondary         | 5.42–6.35                 | ✅                                           |
| muted-strong              | primary-selected                             | 8.34                      | ✅                                           |
| white                     | primary                                      | 4.90                      | ✅                                           |
| white                     | primary-deep                                 | 7.33                      | ✅                                           |
| primary                   | surface                                      | 4.90                      | ✅                                           |
| primary                   | primary-soft / primary-selected / bg-app top | 4.06 / 4.22 / 4.20        | ⚠️ large text only                           |
| **primary-deep**          | primary-soft / primary-selected / bg-app top | 6.07 / 6.31 / 6.29        | ✅ use this for small text there             |
| success                   | surface                                      | 4.68                      | ✅                                           |
| white                     | success                                      | 4.68                      | ✅                                           |
| success-ink               | success-soft                                 | 6.78                      | ✅                                           |
| danger                    | surface / danger-soft                        | 6.51 / 5.58               | ✅                                           |
| white                     | danger                                       | 6.51                      | ✅                                           |
| over                      | surface / bg-app top                         | 4.40 / 3.77               | ⚠️ not for text                              |
| **over-ink**              | surface / bg-app top / middle / bottom       | 5.43 / 4.66 / 5.05 / 4.85 | ✅                                           |
| protein / carbs / fat ink | their `-bg`                                  | 6.71 / 6.75 / 6.57        | ✅                                           |
| white                     | ink                                          | 15.80                     | ✅                                           |
| muted-soft                | surface                                      | 2.77                      | ❌ disabled controls only (exempt from WCAG) |

| UI part                          | Against          | Contrast           |                                                              |
| -------------------------------- | ---------------- | ------------------ | ------------------------------------------------------------ |
| success arc                      | track            | 3.80               | ✅                                                           |
| over arc                         | track            | 3.57               | ✅                                                           |
| protein / carbs / fat bar        | their `-bg`      | 4.64 / 4.31 / 4.02 | ✅                                                           |
| primary border (selected option) | primary-selected | 4.22               | ✅                                                           |
| line                             | surface          | 1.31               | ❌ decorative borders only, never the only edge of a control |
| toggle-off                       | surface          | 1.53               | ❌ open question for the Toggle (not built yet)              |

### Rules that follow from it

- Small text on `primary-soft`, `primary-selected` and text links straight on `bg-app` use `primary-deep`.
- Over-goal numbers and captions use `over-ink`. `over` is only for arcs, dots and bars.
