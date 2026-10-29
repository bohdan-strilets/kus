# Changelog

All notable changes to Kusik are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.1] — 2026-10-29

"Workouts": log a training in the chat like food, fix or delete it, see it on «Сьогодні», and tell Kusik how to address you. Prompt 2026-10-28.1. Three additive migrations (`20261028120000_user_address_form`, `20261029120000_workouts_and_exercises`, `20261030120000_workout_records`); the second refuses to run if `exercise_entries` has rows (check on prod before the deploy). No new environment variables. The «Тренування» tab and the five-tab bar are built but switched off (`FEATURES.workouts = false`) until they are checked on an iPhone; the workout card in the chat and the row on «Сьогодні» are on.

### Added

- `log_workout`: exercises in the user's order, set groups ("3×8 80" is three sets, "8, 8, 6 по 80" two groups), warm-ups, cardio with minutes and distance, `exerciseRef` from the user's own exercise dictionary, `replaceRef` to fix a whole workout of the day, burned kcal only when the user says the number (never added to the goal); together with `log_food` in one message ([470747d])
- `delete_entry` / `restore_entry` take a workout by its `w` ref; "зроби як було" / "як спочатку" restore the `was:` / `originally` values of a changed entry ([470747d], [1b5741c])
- Workouts, exercise dictionary and sets in the database; a record (a heavier working set or a longer distance than ever before, never the first result) is computed when a workout is logged and kept in `workouts.records`; a workout replaced by a later message gets `edited_at` ([2d593e6], [470747d])
- `GET /workouts?from&to` (up to 93 days), `GET /workouts/day/:localDate`, `DELETE /workouts/:id` (soft) and `POST /workouts/:id/restore`, all scoped by the user of the token; another user's workout is `404 WORKOUT_NOT_FOUND` ([e36c5e9])
- The workout card in the chat (exercises, sets, cardio, record badge and the `achieve` sound for a real record, "змінено", "Видалити" with a confirmation), a line "Тренування 26.10 видалено." for a deleted one, the row "Тренування" on «Сьогодні» (also for a day with no food), the «Тренування» tab and the five-tab bar with the raised «Чат» circle (off by default) ([07b1ef7])
- `users.address_form` (MASCULINE | FEMININE | NEUTRAL, default NEUTRAL) and the setting «Як до тебе звертатися» in a new «Kusik» section of the settings; the model context always says `Address form: …` ([1f60192], [a43e7e3], [1b5741c])
- Design for 0.8.1: the address sheet, "Видалити" on the workout card ([1dbcc6d])
- Eval: the `workout` decision, `expect.workouts`, a workouts column, 25 workout cases; the gender check follows the case's Address form (neutral flags any gendered form, masculine / feminine only the opposite one and double forms) ([470747d], [84b3d1a])

### Changed

- Prompt 2026-10-28.1 (texts by the author): the workout rules, the Address form rule. The tool schemas shown to the model drop `default` and `additionalProperties` and write nullable as `type: [X, 'null']` (zod validation is unchanged); the cached prefix is 17 594 tokens (was ~16 770) and a request costs +18 % on the cases shared with 2026-10-27.2 ([470747d])
- The chat history sent to the model keeps Kusik's replies up to 1000 characters (was 500) ([1b5741c])
- A changed entry in the model context lists what it held before ("was: 100 g (originally 80 g)") ([1b5741c])
- After a save or a delete in the entry editor the sheet goes back to the list of the meal's products; the chat stays at the bottom while a sheet is open ([90bdb01])

### Fixed

- Two parallel turns creating the same new exercise no longer fail on the unique name; a workout cannot be replaced and deleted in one message; the backend checks the day of a workout itself; a lost replace race answers `WORKOUT_NOT_FOUND` instead of 500 ([ab5b9cb])

### Eval

- Full run of 2026-10-28.1 on 263 of 265 cases (two private cases were not run): decisions 232/238 on the cases shared with 2026-10-27.2 (233/238 before), calorie error 1.2 / 0.2 % (1.4 / 0.2 %), 24/25 of the new workout cases; the regressions are close-day-unknown (a stricter wording check) and voice-teen-shawarma (a question instead of a log)

### Known

- Gendered forms about the user: 9 of 263 replies with the neutral form (4 of 238 before), three of them double forms such as "готовий(-а)"; planned for the prompt of 0.8.2
- After "видали тренування" Kusik suggests to record it again instead of saying that it can be brought back with "поверни тренування"; planned for 0.8.2
- "зранку пробіг, ввечері зал" is logged as one workout, not two
- The user's data export does not include workouts (there is no export yet; before the beta)

## [0.8.0] — 2026-10-27

"Live Kusik": a new prompt (2026-10-27.2) that describes intent instead of stock phrases, the stats card for any period of 2–92 days, and a stricter eval. No database migrations and no new environment variables; the prompt, the AI tool schemas, the API and the web app all change. Old web clients keep working with the new API (see Changed), so either deploy order works.

### Added

- The model understands any language and style (surzhyk, Polish, Russian, typos, voice dictation, emoji, long texts) and answers in the language of the message; it helps for real with advice ("what should I eat for dinner?", food after the gym) instead of refusing, and politely declines requests far from food and training. Safety rules are part of the prompt: no praise or judgement of the weight-loss speed, no body ratings or comparisons, no supplement or medicine doses, no training through pain, eating disorders gently and without numbers ([49de287])
- `show_stats` takes `days` (2–92) and `endDate` instead of `period` week | month: "за останні 15 днів" gets a 15-day card instead of a refusal. The card payload adds an optional `periodDays` ([49de287])
- The chat stats card follows the new mockups: the title "15 днів · 12.10–26.10" for any length other than 7 and 30 days, a bar chart (one bar per day up to 31 days, weekly averages from 32 days with the caption "стовпчик — середнє за тиждень"), and "19 з 26 · серед днів із записами" (no caption when every day has entries) ([49de287])
- Eval: a hard `--max-cost` (a case starts only if its reserve fits) ([bf40d77]); checks on every reply — gendered forms about the user, item names not from the user's words, reply language, repeated openings, output tokens p50/p90; a hold-out set (`*.holdout.json`, `--set holdout`, never part of `all`) and named day presets for JSON cases ([41defa3]); 42 new cases: 28 "other voices", 8 safety and 6 production findings ([bad4a6f])
- Design for 0.8: workouts, the 5-tab navigation, live texts, hints over the chat and the sport hamster ([8c9bbcb])

### Changed

- The stats card is shown alone: the model's sentence next to it is no longer displayed, like the "День закрито" card ([49de287])
- Replies may be up to 1000 characters (was 500): a log or a card still gets 1–2 sentences, advice up to about six ([49de287])
- Date fields of the AI tools are sent to the model as `format: date` without the long ISO regex; the backend validates dates with the same zod schema as before. Together with the new prompt the cached prefix is ~16 770 tokens (was 17 674), a request costs ~20 % less on the shared eval cases ([49de287])
- The weekly weight change on the chat weight card and on «Прогрес» is a plain fact ("Мінус 0,4 кг за тиждень."), with no comparison to the plan and no words about the speed ([2b2b6a4])
- Old web clients (0.7.1) get `period` as the nearer of week | month for other lengths and ignore `periodDays`: until the PWA updates, a 15-day card there is titled "За 7 днів" while its dates are correct ([49de287])

### Known

- Gendered forms about the user still appear in 1–5 of 240 eval replies; the metric stays in every eval report, and an "address me as" setting is planned for 0.8.1
- The chat history sent to the model cuts each message at 500 characters, so a long piece of advice is seen there shortened

## [0.7.1] — 2026-10-26

Patch "Progress and measurements": the start shown on the measurement card and on «Прогрес» is the same value everywhere, the waist gets its start row, and a period with one measurement shows a change. No database migrations, no new environment variables, no change to the prompt or the AI tools; the API and the web app both change. New response fields of `/progress` have defaults, so either deploy order works.

### Fixed

- The chat card of a waist measurement said "Від старту −2,0 см" where «Прогрес» said −3,0: the card took the start by the time a value was written, so a value entered a minute later with an earlier date (102 cm on 09.10 after 101 cm on 13.10) did not become the start. The start shown on the card and on «Прогрес» is now the earliest value that is not deleted by its day (then `measuredAt`, then `createdAt`); one `getChangeFromStart` counts "from the start" for both ([1189bb6]). Old cards are not stored, they are counted on every read, so they show the corrected number
- The achievements keep their base by creation time (`findFirst`), as before; a test pins that a backdated weight does not move it ([1189bb6])

### Added

- «Прогрес» shows the start of the waist like that of the weight: "Старт 102,0 см · 9 жовт" and "від старту −3,0" ([1189bb6], [db41997])
- A period with exactly one measurement shows the change since the last value before the period ("−3,0 см з 9 жовт") for the weight and the waist, or "За цей період лише один замір" when there is no earlier value; before, such a card had a single point and no badge. `/progress` carries `changeSince` for it ([1189bb6], [db41997])

### Changed

- `progress.weight.start` and `progress.weight.fromStart` are one shared `progress.start` and `progress.fromStart`; `WeightStartRow` became `MeasurementStartRow` for both measurements ([db41997])
- The docs describe the two starts: the one shown (by day) and the achievements base (by creation time) ([8dd7f10])

### Security

- Dependency updates, `pnpm audit --prod --audit-level high` is clean again (four high denial-of-service advisories): `zod` 4.6.5 → 4.6.7, `openai` 7.30.0 → 7.44.0 (its `undici` 8.11.2 → 8.12.3), `@nestjs/platform-express` 11.2.7 → 11.2.8, `body-parser` 2.3.0 → 2.4.0 (through `express`), `multer` 2.4.0 → 2.5.0 (a scoped `pnpm.overrides` entry, because `@nestjs/platform-express` 11.x pins 2.4.0 exactly). No major jumps. Four moderate/low `fast-uri` advisories remain, all through `prisma` > `@prisma/dev` ([79658af])

## [0.7.0] — 2026-10-21

Summaries and the past: closing the day, a stats card on request and "the same as before" entries; prompt version `2026-10-20.2`. Three database migrations (each only adds nullable or defaulted columns) and no new environment variables; the API and the web app both change. Every new response field has a default, so either deploy order works: a new web app reads an old API and an old web app reads the new API (it ignores the new fields: a closed day looks like a plain day card and a stats answer shows only its text). Before the API deploy, check that `food_entries` has no `copied_from_date` or `is_undetailed` column: the third migration stops on purpose if they exist.

### Added

- Closing the day: the `close_day` tool answers "День закрито" / "закрий день" with the day card, a "День закрито" plate and a verdict on the calorie-ring thresholds (97–103 % in goal, above 103 % over, 60–97 % below, under 60 % only the numbers); the sentence under the verdict is fixed text, not the model's ([2d2a220], [a5d263d])
- A day total named by the user ("закрий вчора десь на 2500"): the backend adds the missing part as one estimate entry «Без деталей» (snack, confidence 0.3); the model never subtracts ([2d2a220], [31ec5bb])
- Stats on request: the `show_stats` tool and a card for a week or 30 days (average kcal and protein, days in the norm, weight change, protein goal, weight range, the list of days when fewer than three days are logged), counted by the backend ([2d2a220], [31ec5bb], [a5d263d])
- "The same as before": `log_food.items[].copyRef` copies the values of an entry from the "Earlier entries" context section (built only when the message points to the past); such items skip the kcal/macros check and take their values from the copied entry, which is read again by id and user inside the turn ([2d2a220])
- `TURN_COPY_SOURCE_MISSING` (409): the copied entry vanished mid-turn; nothing is saved and the message can be retried ([2d2a220], [a5d263d])
- Web: the closing day card, the stats card, the "як учора" caption from `copiedFromDate` (over "як завжди", both with the amount), the estimate entry card and compact macro tiles with units ([a5d263d])
- Database: `messages.stats_card`, `ai_runs.cached_input_tokens` (nullable, so the real cache share on production can be measured), `food_entries.copied_from_date` and `food_entries.is_undetailed` ([2d2a220], [31ec5bb])

### Changed

- The reply to a weigh-in on another day starts with its date as dd.mm and never carries the measured value; this removes the clash between the "Weight and waist" and "Other days" rules ([e010b1b])
- "Days in the norm" of the stats card uses the same rule as "Прогрес" (not above 103 % of the goal); the calorie-ring thresholds are shared constants ([2d2a220])
- "на сьогодні все" no longer closes the day ([e010b1b])
- `show_stats` takes `endDate` up to today; `null` means today ([2d2a220])

### Prompt and eval

- Prompt `2026-10-20.2`: sections "Same as before", "Closing the day" and "Stats"; full eval of 190 cases (168 shared with `2026-10-18.1` and 22 new): decisions 190/190, $0.0065 per request, 18.5k tokens in at 95 % cached; details in `PROMPT_CHANGELOG.md` ([e010b1b], [baeabbf])
- The ai-eval runner and 22 new cases for closing the day, stats and "same as before"; the expectations of three older cases are fixed ([2d2a220], [baeabbf])

### Design

- The 0.7 mockups are imported: day closed, stats card, as-yesterday, my products, day start, facts, long advice ([a7024a4])

## [0.6.3] — 2026-10-19

Polish after the 0.6.2 review: the chat header no longer jumps, the edit sheet and the toast follow the design. Web only: no migrations, no new environment variables, no change to the API or to the prompt.

### Changed

- The sheet for editing a meal of another day shows the date ("Понеділок, 19 жовтня") instead of the time, in the subtitle and in the picker; today's meals keep the time ([a3cfd34])
- The toast text is 15/600 and the action is a plain primary 15/700 button, 44 px tall, without an underline ([ab9379b], [7caa0ce])
- The chat header is `absolute` over the feed and the feed is masked below it (`--feed-top`, `@property`), so swapping the full and the compact header no longer relayouts the feed: in a browser run the header was never missing and the reference message moved 0 px on a swipe, on "До останніх" and on focusing the field (it was about 110 ms without a header and a 148.8 px jump); `HEADER_SWAP` moved to `shared/lib/motion` and the settle timer of `use-feed-scroll` is gone ([42addba])

### Removed

- The unused `RecipeTip` component and the `recipe.dinnerTip` key ([733a814])

### Design

- Answers after the 0.6.2 review are imported ([bbd52a3])

## [0.6.2] — 2026-10-19

Food and measurements for other days, corrections of measurements, a day card in the chat and prompt version `2026-10-18.1`. Two database migrations (each is one nullable `ADD COLUMN`) and no new environment variables; the API and the web app both change. The full eval of 168 cases gave decisions 167/168 (the one miss was a case that forbade any digit in a reply that now names the date; the case was fixed and passed on its own), the 33 new cases 33/33 (11/31 on the previous prompt), no failures.

### Added

- Food for other days: from three days back to tomorrow. `log_food` takes a `date` for the call and for each item; the backend groups a message into meals by (day, meal type), picks the meal type by the clock of the turn when the words name none, and sets `eatenAt` to the typical hour of that meal on that day (only tomorrow's meals are deliberately in the future). The turn clock comes from `Message.createdAt`, so a resend after midnight keeps the day the user saw ([e68200d], [68f22ff])
- The model context lists `Days` (today − 3 … tomorrow, with the kcal of each day), `Recent measurements` (seven days) and the entries of other days logged today, so those can be corrected in the chat; a window of days is checked by the parser and again by the backend ([e68200d], [68f22ff])
- A date badge ("Вчора, 17.10", "На завтра, 19.10", "Пт, 16.10") instead of the time on meal cards of other days ([c137946])
- Measurements can be edited, deleted and restored: `PATCH /measurements/:id`, `DELETE /measurements/:id`, `POST /measurements/:id/restore`, soft delete (`deletedAt`), source `EDIT`; on the chat card a "Редагувати" button opens the same sheet as "Мої дані" with "Зберегти" and "Видалити замір", a "· змінено" mark and an undo toast; a deleted value stays in the chat as "Замір … видалено." ([223059e], [8340250])
- The model can remove a listed measurement (`delete_measurement`) and fix one up to seven days back when its value is in the context ([e68200d], [68f22ff])
- The weight start on "Прогрес": "Старт 85,0 кг · 28 серп" and "від старту −2,6 кг"; the start is the earliest weight that is not deleted ([223059e], [8340250])
- The day card in the chat: the `show_day` tool answers "покажи, що є на зараз", "скільки вже набралось?", "а що було вчора?" with a ring, the remainder, protein / carbs / fat, meals and a link to "Сьогодні" with `?date=`; the numbers are counted by the backend and stored as a snapshot in `messages.day_card` ([e68200d], [8e13750], [8338d4c], [3a43f5e])
- "Сьогодні" shows tomorrow: the week strip ends tomorrow, a planned day reads "заплановано", and the empty days have their own states ([e706eb0])
- Prompt `2026-10-18.1`: sections "Other days" and "Day card"; juice, nectar and smoothie without a volume ask about the volume; a feast without a list of dishes is one estimated item of about 2 000 kcal and a named amount is used as is; 33 eval cases for dates, the day card, juice and feasts ([31bab4d], [9c633e2])
- The scroll-to-end button scrolls smoothly on a tap and stays instant for focus, the chips and reduced motion ([da5daf4])

### Changed

- The user's bubble is `primary-soft` with `ink` text and no shadow; the reply about a lost connection is a plain white bubble ([d8b0dbf], [89aa239])
- A new weight or waist goes up to three days back (it was seven) and never to tomorrow; a value of an earlier day is only fixed or removed when it is listed in the context ([e68200d], [68f22ff])
- A kilogram milestone is announced only when the newest weight belongs to the current message and comes from the chat; weights from the profile, edits and back-dated entries stay in the chain without being announced ([8333c27])
- The text of `STORAGE_UNAVAILABLE`: "Не вдалося зберегти фото. Спробуй трохи пізніше або напиши текстом." ([04045d5])
- `limitDecimals` lives in `shared/lib` ([188b462])
- Design mockups for 0.6.2 are imported ([517c286])
- Eval cost per request is 11.5 % higher (16 048 input tokens against 12 533, p50 2.1 s against 2.0 s) because of the longer prompt, two new tools and the `Days` line ([31bab4d])

### Fixed

- A day card for a day older than the logging window answered 500; it is read-only and now only the upper bound (not later than tomorrow) is checked ([3a43f5e])
- A day card of kind "today" taken on a previous day opened today instead of its own day; the link now follows the date of the snapshot ([5aee591])
- The week strip, the selected empty day and an `?date=` beyond tomorrow; the day card shows "з N ккал" in the ring when over the goal and no time for meals of other days; an apostrophe in "П'ятниця" is ASCII ([4523f4e])

### Database

- `20261018172455_measurement_soft_delete`: `ALTER TABLE "measurements" ADD COLUMN "deleted_at" TIMESTAMPTZ`
- `20261018190000_message_day_card`: `ALTER TABLE "messages" ADD COLUMN "day_card" JSONB`

### Tests

- The food streak with entries for tomorrow and for days back is covered: tomorrow is outside the counted range, a back-dated day closes a gap and can reach a threshold ([a027035])

### Known limitations

- The prompt rules "a weigh-in reply has no numbers" and "a reply about another day names the date" contradict each other; the case `weight-yesterday` now forbids only the weight value, the prompt is unchanged
- A back-dated entry can close a gap in the food streak and pay a milestone: two empty days filled afterwards give "3 дні поспіль"
- A meal of a past day without a named type follows the clock of the turn ("позавчора піца" written at 23:00 becomes dinner)
- Six retries against one in the previous full eval, and two answers without a tool call in 174 requests; to be watched after the deploy
- The edit sheet of a meal of another day still shows the time, and several design questions are open (the planned-day remainder, the week strip on an empty tomorrow, the evening tip); taps and scrolling were checked in Playwright, not on a real iPhone

## [0.6.1] — 2026-10-18

Fixes from a week of real use. No database migration and no new environment variables; the API and the web app both change. The model context format changed (prompt version `2026-10-17.1`, the prompt text itself is unchanged); the full eval of 135 cases gave decisions 135/135, categories 104/105 and no failures.

### Added

- Scroll-to-end button in the chat: a 44 px primary round button with a chevron that fades in once the feed is scrolled up by more than the compact-header distance, returns the feed to its end with one tap and does not take focus from the field; label "До останніх повідомлень" ([f36eca7])
- Night greeting "Привіт" between 23:00 and 04:59 in the user's timezone ([5bf3732])
- Eval cases for the edited-entries context: "day closed" and "thanks, that's all" must reply without logging, "one more apple" must log only the apple ([aba8bb2])

### Changed

- Greeting hour bounds are 5 / 12 / 18 / 23 in named constants; the night used to read "Добрий вечір" ([5bf3732])
- The chat scrolls to its end when the field gets focus, when an already focused field is pressed and when a "weight" or "waist" chip is tapped: a `scrollToEndRequest` counter in the composer store replaces the one-shot focus transition ([7d2fa46])
- Model context: user turns in the history start with `[logged: e1, e2]` (a bare `[logged]` when the entries fell out of the window) and an entry changed after logging is marked "(changed after logging)", so the model sees what is already recorded ([6ed57e3])
- Test runs are spent once per stage: new section 8.1 in `CLAUDE.md`, the `verify` skill and the agent descriptions follow it; `apps/api` runs an explicit spec list instead of `vitest related` ([cc6e91e], [768e4ec])
- `progressQueryOptions` is no longer exported from the `entities/progress` barrel; a test that only compared a label with its literal is gone ([241c5ec])
- Prisma 7.10.1 closes the `deepmerge-ts` advisory; `pnpm audit --prod` reports nothing ([bc186c9])

### Fixed

- After an edit made by hand the next message made the model log the same food again with the old numbers from the chat text: the history now says which entries a turn logged and the day list says which were changed ([6ed57e3], [aba8bb2])
- Composer buttons, quick chips and the scroll-to-end button need only one tap with the keyboard open: the field keeps focus through `onMouseDown` only, never `onPointerDown`, because `preventDefault` on `pointerdown` makes WebKit swallow `mousedown`, `mouseup` and `click` on a touch tap ([989980e], [d41e73b])
- The date at the top, "Сьогодні" and "Прогрес" follow midnight and the return of the PWA from the background: one shared clock (a timer aligned to the minute plus `visibilitychange`, `pageshow` and `focus`) replaces a timer per consumer, and the "Прогрес" query key carries the day ([57f7e90], [265fa7f])
- The app shell re-reads the visual viewport on `visibilitychange` (only when visible), `pageshow`, `focus` and `orientationchange`, so a height left by the keyboard cannot stay after returning to the app ([d924d0b])
- Kilograms lost between two chat weights are no longer lost when a weight from "Мої дані" sits between them: the thresholds are counted from the last weight recorded in the chat, every step of the chain to the new record is checked, and a step over 3 kg moves the base and is never paid; nothing is announced from the profile itself ([3e1d1f1])

### Known limitations

- "Сьогодні" with all entries in a single meal and "Прогрес" reported as not scrolling on iPhone were not reproduced in Playwright WebKit; no structural change was made and the case stays under observation until a screenshot and the conditions (PWA or Safari tab, iOS version) are known
- A correction of up to 3 kg in "Мої дані" cannot be told from weight loss and is paid on the next chat weight, as it would be in the chat; a weight added to the chat for an earlier date, below a fresher weight from the profile, announces nothing
- Taps and the keyboard were checked in Playwright WebKit with touch emulation, not on a real iPhone

## [0.6.0] — 2026-10-17

> **Deploy note:** the release needs new Railway variables, and the API does not start in production without them: `STORAGE_PROVIDER=s3`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `STORAGE_KEY_PREFIX`, `PHOTOS_PER_MESSAGE_MAX=1`, `PHOTO_DAILY_UPLOAD_LIMIT`, `AI_DAILY_PHOTO_LIMIT`, `PHOTO_ORPHAN_TTL_HOURS`. The migration `20261015120000_add_stored_files` drops `message_attachments.storage_key` and raises, changing nothing, if any row still has it set. Take a `pg_dump` first (`docs/deploy.md`).

Photo v2, sub-stage A: photos are stored in S3-compatible object storage (Cloudflare R2, EU) and uploaded before the message is sent, instead of travelling as base64 inside `POST /messages`.

### Added

- Storage module: `StorageService` over a `StorageAdapter` (`put` / `get` / `delete` / `deleteByPrefix`), per-user object keys, the `STORAGE_UNAVAILABLE` error, a memory adapter for dev and tests, and an S3 adapter (path-style, SigV4 through `aws4fetch`, so no AWS SDK) that works with R2, Backblaze B2 and the like; production requires `STORAGE_PROVIDER=s3` ([e3e8f77], [ab3aec5])
- Opt-in smoke test that round-trips `put` / `get` / `deleteByPrefix` against a real bucket on a temporary prefix; skipped in `pnpm test` and CI, run with `pnpm --filter api test:smoke:storage` ([caa7912])
- `POST /api/v1/photos`, `GET /api/v1/photos/:id` and `DELETE /api/v1/photos/:id`: a JPEG and its thumbnail are checked (JPEG only, magic bytes, size, dimensions), stripped of metadata and of everything after the end-of-image marker, and stored; reads are owner-only with `nosniff` and `private, immutable` caching; a photo attached to a message cannot be deleted; per-IP throttles, a daily upload limit (`PHOTO_DAILY_UPLOAD_LIMIT`) and the AI photo limit answer `DAILY_PHOTO_LIMIT_REACHED` with `resetsAt`; the body limit comes from the shared photo constants ([8bdd00c])
- `StoredFile` table (original and thumbnail keys, owned by a user, cascade on account deletion) and `fileId` / `position` on `MessageAttachment`; the migration refuses to run while a `storage_key` is set and drops that never-written column ([83955c9])
- `POST /messages` accepts `photoIds`: the bytes are read from storage before the message is created, so a storage failure or a missing object leaves nothing behind; the attachment is created with the message and `unique(file_id)` decides who owns a photo, so replay and retry keep working; messages carry `photos[]` ([65167f2])
- Shared photo constants and schemas (target side 1568 px, thumbnail 768 px / 150 KB, at most 6 photos per message in the schema), `photoIds` in the send-message request and `photos[]` in the chat message ([a06f641])
- Orphan cleanup cron at 03:30: photos uploaded but never attached and older than `PHOTO_ORPHAN_TTL_HOURS` are deleted, sharing one row-locked transaction with `DELETE /photos/:id` so a photo attached in parallel is never lost ([caa5c75])
- Account purge deletes the user's stored objects: expired accounts are walked one by one, the user row is removed only after the storage was cleared, and a failure skips that user until the next run ([fe9a8e5])
- Client upload in two steps: `POST /photos` with progress (the 1568 px photo and a 768 px thumbnail, both re-encoded), then `POST /messages` with `photoIds`; the photo id lives in the outbox, so a retry never uploads twice and a failed message with an uploaded photo survives a reload; the picker accepts `image/*` and a format the browser cannot decode gives a clear error; the camera is disabled until `resetsAt` once the daily limit is reached ([f56c4a7])
- `PhotoTile` in the chat history: the height is known from the API (124–330 px), a skeleton with fade-in while the thumbnail loads, an error state whose retry first renews the session through a light request (an `<img>` bypasses the axios refresh), and a neutral "photo not saved" state; a photo sent in this session keeps showing its local copy ([68dbdf3])
- `image-off` interface icon (53 icons) ([66f8fd2])

### Changed

- `stripJpegMetadata` also cuts everything after the end-of-image marker; photo validation moved to `common/photo`, shared by chat and photos ([8bdd00c])
- Photo error texts follow the design word for word: neutral "photo lost" and "invalid photo", one "too large" text, and the composer shows the first sentence as the problem and the rest as the hint; the retry in a single photo tile uses `primary-deep` (6.5:1 instead of 4.4:1) ([6a28b6f])
- S3 `delete` and `list` requests time out after 10 s (`put` and `get` keep 20 s); the transaction timeouts of photo deletion, the orphan cron and the account purge derive from the worst single request in `storage.constants` ([d34d6d6])
- The daily photo limit text in the composer is `danger` 13/700 as in the mockup; the loading photo tile is `role="status"` ([d34d6d6])

### Fixed

- Restoring an account is allowed only while `purgeAt` is in the future: afterwards `POST /account/restore` answers 409 `ACCOUNT_RESTORE_EXPIRED` even if the purge cron has not run yet; the purge locks the user row (`FOR UPDATE`), removes the storage objects and deletes the row in one transaction, so a restore cannot win in between, and five storage failures in a row stop a run ([d2ffdb4])
- The restore toast says that restoring is no longer possible for `ACCOUNT_RESTORE_EXPIRED` instead of a generic "try again" ([9f1fa85])
- A server failure of a message with a stored photo is retried with its photo id instead of showing "photo lost"; a bubble with a final photo error (`PHOTO_NOT_FOUND`, `PHOTO_IN_USE`) always keeps "Прибрати"; both codes have texts ([d34d6d6])
- The photo sentence split avoids a regex lookbehind, which Safari before 16.4 cannot parse ([6a28b6f])

### Design

- Photo v2 mockups: history tile, multi-photo composer, photo grid in the bubble, full-screen viewer and memory thumbnail, plus the remaining states (retry tile, viewer loading and failure, daily limit during upload, plural error texts) and the 132 px composer max-height fix ([1e7d5e7], [5f13da4])
- Sub-stage A sync: neutral error texts, one `photoTooLarge`, `primary-deep` for the single-tile retry, Skeleton pulse instead of the shimmer and a 1 px dashed outline for photos that were not saved ([6ed00d5])

### Docs

- Stored photo flow, restore rule after the grace period, privacy and rules in `docs/architecture.md` and `CLAUDE.md`; photo-storage release steps (R2 EU bucket, variables, `pg_dump`, `storage_key` check, smoke test) in `docs/deploy.md` ([ba97a30], [c92a9fb], [2b7a320])
- Sentry is marked as planned before the beta, not as present ([c426aad])

### Known limitations

- One photo per message for now (`PHOTOS_PER_MESSAGE_MAX=1`); several photos are the next stage
- The photo eval (D1) is postponed
- The old `photo` field stays in the API and types for cached clients and is removed in B2.6 ([68dbdf3], [65167f2])

## [0.5.3] — 2026-10-14

Design sync with `design/` v0.5.2. Web only: no API, shared-package or migration changes, so no database backup is needed.

### Added

- `--color-accent-on-dark` token and a `accentOnDark` tone for `Text`, used by the "Обговорити в чаті" link with a 16 px chevron ([7ccee90], [134f21e])
- `tape` icon (52 interface icons) and icons in the "Навіщо й як міряти" sheet sections ([25e3c3a], [6c083d9])
- `Hamster` `badge` prop: the `proud` mood shows the number of days, or a star without it ([14ca806])
- Weight chart on "Прогрес" labels the first value and ends in a dot with the latest value; no grid ([513936a])
- Waist card on "Прогрес" with its own chart, change badge and dates; it is always shown, with a hint on how to log a waist when there is nothing in the range or no waist at all ([bcf55e5], [cb42758], [b5f98e9])
- Achievement card per `chat-achievement`: eyebrow, 34/800 number with a unit, caption, a phrase and the next streak milestone; the pop, confetti and count-up are unchanged ([3947221])
- Photo in the composer per `chat-photo-preview`: 64 px thumbnail with a remove button, a hint when ready, a scrim and a loader while preparing, and an error tile with a title and a short what-to-do hint per reason ([1825d9c], [b6934e2])

### Changed

- Weekly calories: success bars, the part above the goal in solid `over` clipped at the goal line, today outlined with a dashed stroke and its value, an "понад ціль" legend and a summary naming the days above the goal ([7fc47ba])
- Composer placeholder and the empty "Сьогодні" text no longer address the user in a gendered past tense; the unused `pages.chat.placeholder` is gone ([137b229])
- Streak phrases read as one family ("… із записами"); the single waist tile spans the whole card ([90b4403])
- Measurement deltas always show one decimal ("−2,0 см"); the quick chips keep hiding while a photo is attached ([b5f98e9], [b6934e2])

### Fixed

- The chat feed keeps the distance to the bottom when the day card above it folds or unfolds, so the messages being read no longer jump by the height change ([a3308b2])
- Confetti particles no longer outlast the level duration: the spread is 0.8–1.0 instead of 0.8–1.2 ([4ca87d5])
- `tailwind-merge` no longer drops `text-achievement`, `text-field-number`, `text-field-number-sm` and `text-name` next to a text colour; the achievement number now renders at 34/800 ([b5f98e9])
- Fresh achievement card shows its final number at once with reduced motion, and only a fresh card is a `status` live region ([b5f98e9])

## [0.5.2] — 2026-10-13

> **Deploy note:** the release carries a migration that drops `weight_entries`. Take a `pg_dump` first (`docs/deploy.md`); the migration aborts, changing nothing, if a `weight_entries` row has no matching `WEIGHT` measurement for its user and day.

### Changed

- Weight and waist are rounded to one decimal in code, the same way Postgres rounds `Decimal(4,1)`, so the range and jump checks run on the stored value ([1dea373])
- The deprecated `weight_entries` table is dropped; a guard in the migration raises instead of deleting a row that was not copied to `measurements` ([804831d])
- The `ui-checker` agent deletes its throwaway user by exact email after the UI run, only after confirming that `DATABASE_URL` points at localhost / Docker, and reports the host only ([dea8e1c], [a2a768a])

### Fixed

- Saving the weight or waist in "Мої дані" keeps the chat card attached to the day's measurement and refreshes the chat feed at once ([69bce19])
- Cyrillic food names that contain Latin lookalike letters (for example a Latin "a" inside "курячa") are normalized in log entries, clarify options and entry edits, and memory matching covers both old and new spellings; stored entries are not rewritten ([596e30e])
- Closing the bottom sheet returns focus to the element that opened it, instead of leaving it on the page body; on iOS Safari a tap does not focus a button, so this applies to keyboard, VoiceOver and desktop ([8302cf8])

### Security

- `mysql2` is pinned to 3.23.1 through a pnpm override, the lowest version that fixes GHSA-3f6p-5ww8-9rcr and GHSA-rgwj-5xj2-c3m3; Prisma's CLI pulled in an older one. The remaining `deepmerge-ts` finding (GHSA-ggr8-5vv4-36mx) is an accepted CLI-only risk, see `docs/deploy.md` ([0f3d975])

## [0.5.1] — 2026-10-13

### Added

- "Талія" row in "Мої дані" under the current weight: the latest waist or "Не вказано", a number sheet in cm with tenths (40–200); `PATCH /api/v1/profile` takes `waistCm` and writes a `WAIST` measurement for today with source `PROFILE` (one per day, upsert), and the profile response carries `waist` ([5f774cf])
- A caption under the "Тіло" section with the "Навіщо й як міряти" link and a sheet that explains why Kusik asks for weight and waist and how to weigh and measure; one-line hints under the weight and waist fields ([5f774cf])
- "Додати талію" chip next to "Додати вагу" above the composer: puts «талія » into the field and focuses it ([88b5448])

### Changed

- `useStartWeightDraft` became `useStartMeasurementDraft(kind)`, shared by the two chips and the progress tab ([88b5448])
- The weight and waist number field keeps one decimal at most while typing; saving the waist also refreshes the day, which feeds the progress tab ([5f774cf])

## [0.5.0] — 2026-10-13

> **Deploy note:** the release carries a migration. Take a `pg_dump` first (`docs/deploy.md`); the migration aborts, changing nothing, if `weight_entries` holds a `note` or two rows for one `(user_id, local_date)`.

### Added

- Weight and waist from the chat: the `log_measurement` tool (`kind`, `value`, `date`, `confirmedJump`) next to `log_food` or `reply`; a value is checked for range (weight 30–300 kg, waist 40–200 cm), date (not in the future, at most 7 days back) and one measurement per kind in a message; a weight more than 3 kg from the nearest earlier one within 7 days, or more than 15 kg from the last one of any age, is not logged until the user confirms it; a fix of a day's value replaces it and the old reply loses its card ([ad91622], [3a054aa], [26644b6])
- `Measurement` and `Achievement` tables, with a guarded backfill of `weight_entries` (it fails loudly on a `note` or duplicate days instead of losing data) ([ee7ffc5], [84eab64])
- «Вагу записано» / «Талію записано» card in the chat: value, five-week sparkline, from start, to goal («Ціль досягнута» at the goal), a pace sentence and a link to the progress tab ([4007f0c])
- «Прогрес» tab: a 7 / 30 / 90 day switch for weight and waist, the calorie and protein week (always 7 days, today paler, goal dashes), averages, a template insight from the hamster, an empty state and a note when the chosen range has no weighings; `GET /api/v1/progress?range=7|30|90` with date bounds in the user's timezone ([35cec38], [ba56acd])
- Achievements: every whole kilogram below the first recorded weight (goal LOSE or none) and food streaks of 3, 7, 14, 30, 60 and 100 days, written in the chat turn transaction with `ON CONFLICT DO NOTHING`; a fresh one shows a card with a pop, a count-up, confetti, the `achieve` sound and a vibration, and mutes the day-goal celebration so the sounds do not overlap; a step of more than 3 kg awards nothing ([a243e49], [8fbbe08], [3a054aa])
- «Додати вагу» chip above the composer: puts «вага » into the field and focuses it, shared with «Записати вагу» on the progress tab; the row folds away while the draft has text or a photo ([be4e082])
- ai-eval: 25 measurement cases, the validation errors and tool names of every failed attempt in the results JSON, a mixed Cyrillic / Latin word check, and `replyIncludesAny` ([bcaf8df], [79b513a])

### Changed

- The profile reads and writes the current weight through `measurements`; `weight_entries` is deprecated and is dropped by a separate migration in the next release ([26644b6])
- Prompt 2026-10-13.5: a section on weight and waist, a bare number is a weight only when the previous weight is within 15 kg (otherwise Kusik asks what it is), `log_measurement` is not called when nothing is logged, and replies avoid past-tense verbs and short adjectives about the user ([ad91622], [3a054aa], [2c5f417], [aa23cb4], [e4861eb])
- `CLAUDE.md`: `prompt.ts` changes only with verbatim text the author approved, and only one test pass runs at a time because the e2e tests share and truncate `kus_test` ([9844536], [c0d47d2])
- Architecture and database docs describe measurements, achievements and the progress endpoint ([fe88f81])
- API e2e test timeout raised to 30 s ([2caafc7])

### Fixed

- Two parallel first turns of the day no longer fail with a unique violation when the daily usage row is created ([2843d76])
- One pace sentence, one set of `uk.json` keys and the same grades for the chat card and the progress insight; the chart label no longer claims five weeks, and the tap zones of the range switch and the progress link are 44 px ([8adeea6], [79a499e], [5d500bd])

### Tests

- Coverage for the measurements repository, achievement edges, progress bounds, `log_measurement` parsing and the new hooks ([8c1de34])

## [0.4.0] — 2026-10-12

### Added

- Fresh meal cards in the chat come alive: the lines cascade in 60 ms apart, the kcal in the card header and in every line count up (from 0 for a new card, over 300 ms when a value changes), and a green «Записано» badge pops in the top right corner with four crumbs, holds for 1.5 s and fades out. Only for replies that arrived in this session and are not older than 10 s, so history, a reload and a late return to the chat stay still ([ad922dd], [db239b6])
- Sounds in the chat: `clarify` when Kusik asks a question (instead of `kusik` for a reply that also logged food), `oops` when a message could not be sent, including a photo without a connection (not while the server is still finishing the turn); one sound per reply, `photoFail` > `clarify` > `kusik` ([db239b6])
- The hamster hops when its mood changes (`useHopOnMoodChange`, off under reduced motion); the unused `.k-hop` CSS is gone ([c788432])
- Day goal celebration: when the user's own action (a message, an answer to a question, an edit or a removal) moves the calorie ring from under the goal into the 97–103 % band, the ring glows (`success` layer, opacity and scale only, new token `--blur-glow`), 12 particles fly around it (40 px in the collapsed chat header) and `goal` sounds once the ring is drawn; the reply that closed the goal gets the `happy` face. Once per user and local day (`kusik-goal-celebrated:<userId>:<date>` in localStorage, no food data); a detected goal expires after 3 s if no ring is on screen and is never replayed; nothing on open, reload, a jump past the band or a goal change ([279739a], [f06b7ff])

### Changed

- `useCountUp` takes an `initial` start value, and its second effect run under StrictMode repeats the same count instead of starting from the final value ([4212861], [ad922dd])
- The `add-sound` skill and the dev-ui sounds hint match the code: file names, and both switches are on by default ([6e5c3a0])
- The `ui-checker` agent is limited to 2 AI calls per check, shoots animations as paused frames and deletes its test users ([a6cb8ae])

## [0.3.1] — 2026-10-12

### Fixed

- «Спробувати ще» under a photo works on the first tap after airplane mode: the `navigator.onLine` check, which iOS keeps false for a few seconds after reconnecting, now guards only the first send; a resend always goes to the network and shows the network failure if there really is no connection ([57772fe])

## [0.3.0] — 2026-10-12

### Added

- Photo in the chat: the camera button opens the system picker; the picture is decoded, drawn to a canvas and re-encoded as JPEG ≤ 1568 px, ≤ 1 MB on the phone, so Exif (GPS) never leaves it. Preview row with «Прибрати фото», a loader after 300 ms, an inline error for files the browser can't decode; the bubble shows the picture with the upload progress for the session and a «Фото» row after a reload ([9287baa])
- `POST /messages` accepts `photo { mimeType, data }` next to the optional text: magic bytes, `image-size`, 64…2576 px, ≤ 1.4 MB and JPEG metadata stripping inside the DTO pipe; a `MessageAttachment` row per photo (no bytes) and `FoodEntry.fromPhoto` (migration `add_food_entry_from_photo`); `AI_DAILY_PHOTO_LIMIT` (30) reserved atomically with the message counter, 429 `DAILY_PHOTO_LIMIT_REACHED`; `AI_MODEL_VISION` for photo turns ([9b60374])
- Tool `photo_unusable` (`no_food` | `unreadable`), accepted only for a message with a photo and never together with `log_food`; the model request carries the image as a part before the text, history turns show «[фото]» instead of the image. Prompt 2026-10-11.1 «# Photos» ([ef4bb98]); prompt 2026-10-11.2: a question next to a photo is answered with `reply`, not logged ([0a29064])
- Estimated portions (source `ESTIMATE`, not corrected by hand) read «≈ 350 г» in the chat card, «Сьогодні», the entry picker and «було …» ([74cb513], [ebcad96])
- ai-eval: private cases with an `image`, `expect.sources`, `photo_unusable` as an expected decision ([2976c7a])

### Changed

- A photo message the server could not process can be hidden with «Прибрати»; upload progress and sent previews live in an in-memory session store instead of `localStorage`; the file input no longer lists HEIC (iOS converts to JPEG itself); body parsers run after CORS, so a 413 carries the CORS headers ([ebcad96])
- The exception filter redacts data URLs and long base64 runs from traces; the OpenAI client never logs request bodies ([9b60374])
- Docs: the photo turn, limits, privacy note and backlog in `docs/architecture.md`; `docs/deploy.md` describes the `pg_dump` backup as it is done on Windows through the Railway TCP proxy ([bb32583], [f3e4ebb], [527efe2])

### Fixed

- The audio is unlocked on the first tap anywhere in the app (one `click` listener in `RootLayout`), not only on «надіслати» ([72566a9])
- Leaving the session (logout, account deletion) forgets what the calorie ring and the macro bars showed, so the next account animates from 0 ([30873de])

## [0.2.2] — 2026-10-11

### Fixed

- Sounds on iPhone: the audio context is unlocked inside the tap on «надіслати» / «Спробувати ще», so the «кусь» that plays after the API answers is no longer blocked by iOS ([4f65daf])
- The calorie ring, its number and the macro bars animate only on the first show per session and when the value changes — from the previous value, not from 0; a plain return to the tab draws the final state at once (`useRevealedValue` in `shared/lib/motion`) ([f8bb810])
- Settings shows the full version («0.2.1»), not only major.minor ([18570d0])

## [0.2.1] — 2026-10-11

### Added

- `useStackBack` in `shared/lib/history`: the one «back» of the profile stack — the previous entry when this app session has one, otherwise a replace with the parent screen ([e713895])

### Changed

- Tab switches (bottom nav, day card, compact bar, yesterday recap, empty-day action) replace the history entry instead of pushing, so Back / iOS swipe leaves the app like a native tab bar ([b1fedb6])
- Deploy docs: the pre-migration backup is a `pg_dump` through Docker instead of a Railway volume backup ([c4d7e50])

### Fixed

- «Назад» in the profile stack returns where the screen was opened from; the iOS swipe-back no longer reopens a screen just left. «Скасувати» on the recalc screen, a saved goal and a changed password leave the same way ([be685d9])

### Removed

- `PUT /goals/current` with its DTO, shared schema and specs — the goal sheet has used `PUT /profile/goals` since 0.2.0 ([150985a])

## 0.2.0 / 0.1.0 — see tags

[Unreleased]: https://github.com/bohdan-strilets/kus/compare/v0.8.1...HEAD
[0.8.1]: https://github.com/bohdan-strilets/kus/compare/v0.8.0...v0.8.1
[1f60192]: https://github.com/bohdan-strilets/kus/commit/1f60192a7f31e22168ed643da4ad496159ca7a5d
[90bdb01]: https://github.com/bohdan-strilets/kus/commit/90bdb0106aa9d329f108bcc16fad0a4deb8eda74
[1b5741c]: https://github.com/bohdan-strilets/kus/commit/1b5741c2ed8b82da22b878c7093c35b9e62c35f4
[2d593e6]: https://github.com/bohdan-strilets/kus/commit/2d593e67e93b46487706740e14c12eca9034fb17
[e36c5e9]: https://github.com/bohdan-strilets/kus/commit/e36c5e9a03d6f8f877af0d4cff0dc3f3319444ca
[470747d]: https://github.com/bohdan-strilets/kus/commit/470747d9741036946384919bbff149d047ed78dd
[84b3d1a]: https://github.com/bohdan-strilets/kus/commit/84b3d1a5bf53af128a9708059a7693304a04d7ff
[1dbcc6d]: https://github.com/bohdan-strilets/kus/commit/1dbcc6dfcfe9494953dcfaa6c73f31d2a1737fe0
[ab5b9cb]: https://github.com/bohdan-strilets/kus/commit/ab5b9cb9340c2ca75df1f9e9977628556e016b7f
[07b1ef7]: https://github.com/bohdan-strilets/kus/commit/07b1ef780ed8d45a00e73ae007fd64d7e81253ff
[a43e7e3]: https://github.com/bohdan-strilets/kus/commit/a43e7e3ab97623223609eb794d3360e712f7e3f7
[0.8.0]: https://github.com/bohdan-strilets/kus/compare/v0.7.1...v0.8.0
[8c9bbcb]: https://github.com/bohdan-strilets/kus/commit/8c9bbcb12f8fc5e15f2c305324f44efcc49657f3
[bf40d77]: https://github.com/bohdan-strilets/kus/commit/bf40d776168a4c5b376f64e064cf5511eba6ab3a
[41defa3]: https://github.com/bohdan-strilets/kus/commit/41defa30b14cb9be501b2839b4dcdc5c412d35e4
[49de287]: https://github.com/bohdan-strilets/kus/commit/49de287b8697499f8ea26f7c96c228f091802642
[bad4a6f]: https://github.com/bohdan-strilets/kus/commit/bad4a6fca0dd415f5d08735b4105c59d98d5c103
[2b2b6a4]: https://github.com/bohdan-strilets/kus/commit/2b2b6a4124c7fc818afb4cde3ffbc794329bd216
[0.7.1]: https://github.com/bohdan-strilets/kus/compare/v0.7.0...v0.7.1
[1189bb6]: https://github.com/bohdan-strilets/kus/commit/1189bb6e8fee296c9b094a2bafe27a76689d4ca4
[db41997]: https://github.com/bohdan-strilets/kus/commit/db419977813032a952ae3df55265b67bc062a51d
[79658af]: https://github.com/bohdan-strilets/kus/commit/79658af2f38b764e7a3da5de404d47dd927cc814
[8dd7f10]: https://github.com/bohdan-strilets/kus/commit/8dd7f103f4f3e678e5d3c19cec65b867b67fe139
[0.7.0]: https://github.com/bohdan-strilets/kus/compare/v0.6.3...v0.7.0
[a5d263d]: https://github.com/bohdan-strilets/kus/commit/a5d263d8552b60b160e99e60273234b883d110d7
[31ec5bb]: https://github.com/bohdan-strilets/kus/commit/31ec5bbdb4cd56f130b614d1046a77887d162725
[e010b1b]: https://github.com/bohdan-strilets/kus/commit/e010b1be9e599a88e9979a9966526a792dd4cba6
[baeabbf]: https://github.com/bohdan-strilets/kus/commit/baeabbf549a12f1ee326c7e85e1bea8145075d8b
[2d2a220]: https://github.com/bohdan-strilets/kus/commit/2d2a2200aa5bab50ffc3495a6df68af8aa904309
[a7024a4]: https://github.com/bohdan-strilets/kus/commit/a7024a418efc9b7caeb638bfb0fe0319c114fcd4
[0.6.3]: https://github.com/bohdan-strilets/kus/compare/v0.6.2...v0.6.3
[a3cfd34]: https://github.com/bohdan-strilets/kus/commit/a3cfd34f69256c9c73a49e24e01269319bf75f1f
[ab9379b]: https://github.com/bohdan-strilets/kus/commit/ab9379b87eaad0616bdd29787592f45d97be6583
[7caa0ce]: https://github.com/bohdan-strilets/kus/commit/7caa0ce6d161f3d3745b9d8293833a035aaa3089
[42addba]: https://github.com/bohdan-strilets/kus/commit/42addba78c2bfd2eb7c3368c1f8282fd8384c91f
[733a814]: https://github.com/bohdan-strilets/kus/commit/733a814ebfb7851743ecc89862a954c57a390785
[bbd52a3]: https://github.com/bohdan-strilets/kus/commit/bbd52a3f77172ef5d855a972ce8e6290ab613b4c
[0.6.2]: https://github.com/bohdan-strilets/kus/compare/v0.6.1...v0.6.2
[5aee591]: https://github.com/bohdan-strilets/kus/commit/5aee591eb2d538bf490fa5253854d4c4bf1dad5e
[e68200d]: https://github.com/bohdan-strilets/kus/commit/e68200d7dcc1e90a7bbb31a1a285d1ad3cde1245
[68f22ff]: https://github.com/bohdan-strilets/kus/commit/68f22ffd7cf1a1d8a1691625ee33ecc9dc21f43f
[c137946]: https://github.com/bohdan-strilets/kus/commit/c137946de9696bcbb55d5a2b85b9e8f2cb77d64f
[223059e]: https://github.com/bohdan-strilets/kus/commit/223059eb4642dce10a6014522511b6470fb120a7
[8340250]: https://github.com/bohdan-strilets/kus/commit/8340250e6171cddb5d85cc439a5c2338507e26e0
[8e13750]: https://github.com/bohdan-strilets/kus/commit/8e13750eece2ad9e6f7c34cc9622dc9d7d5cbf32
[8338d4c]: https://github.com/bohdan-strilets/kus/commit/8338d4ce86380239182f47f462dbcbea1a978cb1
[3a43f5e]: https://github.com/bohdan-strilets/kus/commit/3a43f5e30fed05318cc86fc2befb81d1ab8a5373
[e706eb0]: https://github.com/bohdan-strilets/kus/commit/e706eb0ce043e33a12b0a77a48e8b89838d754cf
[31bab4d]: https://github.com/bohdan-strilets/kus/commit/31bab4dcabdde53ea831f8524db8896255c0414c
[9c633e2]: https://github.com/bohdan-strilets/kus/commit/9c633e287e2a300ce2a60a806f8816314b04d00b
[da5daf4]: https://github.com/bohdan-strilets/kus/commit/da5daf4f182f45d6ee962edf233c92e7ab33324e
[d8b0dbf]: https://github.com/bohdan-strilets/kus/commit/d8b0dbf1191030f623f4ebcb9110e7cf564b3e75
[89aa239]: https://github.com/bohdan-strilets/kus/commit/89aa239ae7457e91703c017474a62aab1ff0ef81
[8333c27]: https://github.com/bohdan-strilets/kus/commit/8333c27a6579cc0a196845220175e094d98e6c6c
[04045d5]: https://github.com/bohdan-strilets/kus/commit/04045d5a2a93378495b63e6f1d6f3d3f54eb99ac
[188b462]: https://github.com/bohdan-strilets/kus/commit/188b462054f0a8fd9ed33a930a4bb717aaedc2ba
[517c286]: https://github.com/bohdan-strilets/kus/commit/517c286d720a2deff86f616f452bc8596863f49d
[4523f4e]: https://github.com/bohdan-strilets/kus/commit/4523f4e0a78125479e7117095f28e0e8755f2e2a
[a027035]: https://github.com/bohdan-strilets/kus/commit/a02703503d427fef3dca76a424945ce75cff9173
[0.6.1]: https://github.com/bohdan-strilets/kus/compare/v0.6.0...v0.6.1
[bc186c9]: https://github.com/bohdan-strilets/kus/commit/bc186c928fea4990147b90a3c95683b6e694f564
[6ed57e3]: https://github.com/bohdan-strilets/kus/commit/6ed57e3c7802ba52f8b5ac9484dd86508b6f1f1f
[aba8bb2]: https://github.com/bohdan-strilets/kus/commit/aba8bb2d3d70550e70ef951df9083dee4af84bd7
[989980e]: https://github.com/bohdan-strilets/kus/commit/989980eed703d0a3bc3751348bfb428160cb8e8e
[57f7e90]: https://github.com/bohdan-strilets/kus/commit/57f7e90f05efa579b4cc7aa5159b89afb4e8fadd
[265fa7f]: https://github.com/bohdan-strilets/kus/commit/265fa7f95fe51b8764721d0dc898c2ce9e8029e9
[5bf3732]: https://github.com/bohdan-strilets/kus/commit/5bf3732de00b8fee6ce1050281410d8ed061c7a9
[7d2fa46]: https://github.com/bohdan-strilets/kus/commit/7d2fa46b1a0533517bf303c15b1687880faa1e22
[f36eca7]: https://github.com/bohdan-strilets/kus/commit/f36eca7b7b17007be7183af2d04739ff7d2bec5f
[cc6e91e]: https://github.com/bohdan-strilets/kus/commit/cc6e91e27450058dd74e081bbd110b9d25bf40f3
[3e1d1f1]: https://github.com/bohdan-strilets/kus/commit/3e1d1f18fe52dae0147b3b02b26a4e29f08a3b94
[768e4ec]: https://github.com/bohdan-strilets/kus/commit/768e4ecdaa657a061c901842da1ca53af909b835
[d924d0b]: https://github.com/bohdan-strilets/kus/commit/d924d0bc683cb06c21086d1e6fefb3f3dfb4d5f5
[d41e73b]: https://github.com/bohdan-strilets/kus/commit/d41e73bfeb4dd1d97659ff1ffcc280993262d8f2
[241c5ec]: https://github.com/bohdan-strilets/kus/commit/241c5ec8b315917c063964aa81e95e8f8c76b557
[0.6.0]: https://github.com/bohdan-strilets/kus/compare/v0.5.3...v0.6.0
[e3e8f77]: https://github.com/bohdan-strilets/kus/commit/e3e8f778460e737d14a5606ecd53efcc7f307085
[ab3aec5]: https://github.com/bohdan-strilets/kus/commit/ab3aec5b4a1d4a6a3e5b9a4bacfbe307cc75a15c
[caa7912]: https://github.com/bohdan-strilets/kus/commit/caa79121d7fcbcc2de1dfdae4233ac2cfe6e05c1
[1e7d5e7]: https://github.com/bohdan-strilets/kus/commit/1e7d5e7c24140cba2054c17ae8647ee754678fe4
[a06f641]: https://github.com/bohdan-strilets/kus/commit/a06f64166db6775865a9d3002b60f2491175381e
[83955c9]: https://github.com/bohdan-strilets/kus/commit/83955c99edc5d9825063cef32e4419784bc8d522
[5f13da4]: https://github.com/bohdan-strilets/kus/commit/5f13da4918562b133089aad14035f4cba3658b92
[8bdd00c]: https://github.com/bohdan-strilets/kus/commit/8bdd00cc50d5d9b1cd09f0030c31e28c70a50ed7
[65167f2]: https://github.com/bohdan-strilets/kus/commit/65167f2889705609cb32fa8253240faf7dc70371
[fe9a8e5]: https://github.com/bohdan-strilets/kus/commit/fe9a8e577a98e6e436db0768ebdb1c222854a504
[caa5c75]: https://github.com/bohdan-strilets/kus/commit/caa5c75b0743a59293eea6b7f4995d3595a8392e
[d2ffdb4]: https://github.com/bohdan-strilets/kus/commit/d2ffdb4cbb8b48fa2282094536b18de242f5ac83
[9f1fa85]: https://github.com/bohdan-strilets/kus/commit/9f1fa854d2c6ebe5c2e6d7f415815120abb054e0
[66f8fd2]: https://github.com/bohdan-strilets/kus/commit/66f8fd2df003b26a0c48dfa026698b17caf8817f
[f56c4a7]: https://github.com/bohdan-strilets/kus/commit/f56c4a7652c474b9b4872cbc41171a5f96afd02d
[68dbdf3]: https://github.com/bohdan-strilets/kus/commit/68dbdf365c6cfb58afec8287893b712a2de6df0f
[ba97a30]: https://github.com/bohdan-strilets/kus/commit/ba97a30d3fd563a49139eb7df733f029587de578
[c92a9fb]: https://github.com/bohdan-strilets/kus/commit/c92a9fb5143991562a8d034678b2af3891c1172c
[6ed00d5]: https://github.com/bohdan-strilets/kus/commit/6ed00d5ebe816b283f927e4c444f55e1e8eac560
[6a28b6f]: https://github.com/bohdan-strilets/kus/commit/6a28b6f838526546f4f3ab9d241664b57f4b3269
[d34d6d6]: https://github.com/bohdan-strilets/kus/commit/d34d6d668e5f663368813150fec266f5f190d597
[c426aad]: https://github.com/bohdan-strilets/kus/commit/c426aaded04e8d5937b3065fb9288c9ccfa20442
[2b7a320]: https://github.com/bohdan-strilets/kus/commit/2b7a320c495060c2f807b7003f1dceb71d81b013
[0.5.3]: https://github.com/bohdan-strilets/kus/compare/v0.5.2...v0.5.3
[7ccee90]: https://github.com/bohdan-strilets/kus/commit/7ccee906f136f7308280770d18ba120957e514f2
[4ca87d5]: https://github.com/bohdan-strilets/kus/commit/4ca87d59519ff534ad45456abbdf3ed61ad35ba9
[25e3c3a]: https://github.com/bohdan-strilets/kus/commit/25e3c3a6a4bd9fe4a51063f88dc49f5ca9925d8e
[14ca806]: https://github.com/bohdan-strilets/kus/commit/14ca80609a25df0df3d3adca0f1f1ca3fe19cb34
[a3308b2]: https://github.com/bohdan-strilets/kus/commit/a3308b26c1f5688605468dbf8e099da208cec71c
[513936a]: https://github.com/bohdan-strilets/kus/commit/513936a1ed0e6665e8beca61427b2fde543890c7
[bcf55e5]: https://github.com/bohdan-strilets/kus/commit/bcf55e55189d42b3a67615e7db7537973a816490
[cb42758]: https://github.com/bohdan-strilets/kus/commit/cb4275851ff03722c215c466823eb8e2679ce53c
[7fc47ba]: https://github.com/bohdan-strilets/kus/commit/7fc47ba1b21675dfefcb8e90a0b9ad067e7610b3
[134f21e]: https://github.com/bohdan-strilets/kus/commit/134f21ef66ed1b13b40157845d1b159ebdb84a42
[137b229]: https://github.com/bohdan-strilets/kus/commit/137b229bcaa9e4bc009c36c25468d223181add53
[1825d9c]: https://github.com/bohdan-strilets/kus/commit/1825d9c5eec63967860da41f177bfb0d6a394086
[b6934e2]: https://github.com/bohdan-strilets/kus/commit/b6934e2d1eb06bf4fd328e36e2fcd05e3f988641
[6c083d9]: https://github.com/bohdan-strilets/kus/commit/6c083d991a5cadd5ca0b837358423007cbdab816
[3947221]: https://github.com/bohdan-strilets/kus/commit/3947221e3dcf6ea3f468080cb19eb810158565e5
[90b4403]: https://github.com/bohdan-strilets/kus/commit/90b4403f16c13f0fe9aaef4852bfa93d3a93005f
[b5f98e9]: https://github.com/bohdan-strilets/kus/commit/b5f98e9d7f031bb3bb09a2d34765f0e7a0367bd8
[1dea373]: https://github.com/bohdan-strilets/kus/commit/1dea37399e17617c523736db7d448435b3d11377
[69bce19]: https://github.com/bohdan-strilets/kus/commit/69bce1988182258a66dc0c0537cbee1be61d674f
[596e30e]: https://github.com/bohdan-strilets/kus/commit/596e30ebb9922d37b9573c7d4665547bcaf9ef9f
[8302cf8]: https://github.com/bohdan-strilets/kus/commit/8302cf87c4e45ee6abffdfce152dff34de2dd890
[804831d]: https://github.com/bohdan-strilets/kus/commit/804831d9a723267524d8b51402f41d9367d5539a
[dea8e1c]: https://github.com/bohdan-strilets/kus/commit/dea8e1c909c056ac426c857448fa6d91d8f684f7
[0f3d975]: https://github.com/bohdan-strilets/kus/commit/0f3d975bd0135135fe2ab0c67301d2d1b3bbb015
[a2a768a]: https://github.com/bohdan-strilets/kus/commit/a2a768af5028039a5f1e377c7891b1246ef589e4
[0.5.2]: https://github.com/bohdan-strilets/kus/compare/v0.5.1...v0.5.2
[5f774cf]: https://github.com/bohdan-strilets/kus/commit/5f774cf062a22eb490272e215a643a3a798fbd92
[88b5448]: https://github.com/bohdan-strilets/kus/commit/88b54489b697818590e07c349e6e6c40fa490160
[0.5.1]: https://github.com/bohdan-strilets/kus/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/bohdan-strilets/kus/compare/v0.4.0...v0.5.0
[ad91622]: https://github.com/bohdan-strilets/kus/commit/ad916222f9b06cda897381d50193284e94566ad8
[ee7ffc5]: https://github.com/bohdan-strilets/kus/commit/ee7ffc545603d467ae5abd4db4aaea7461a0cf5b
[26644b6]: https://github.com/bohdan-strilets/kus/commit/26644b6d45eda7725e1207253283d43cd111ba47
[4007f0c]: https://github.com/bohdan-strilets/kus/commit/4007f0c65e90e020dc18acb35c25f5b50ff5bd8c
[35cec38]: https://github.com/bohdan-strilets/kus/commit/35cec38f5550bad70e828d3ff59a6a2ba69e7f7d
[ba56acd]: https://github.com/bohdan-strilets/kus/commit/ba56acd775c146b85aca6bb4beb10655c29962cb
[a243e49]: https://github.com/bohdan-strilets/kus/commit/a243e49fbf7e3d606ff2bc0e721dbe8f44f42cfb
[8fbbe08]: https://github.com/bohdan-strilets/kus/commit/8fbbe08301b0e12b6001c20bf45dc812f81fd13f
[be4e082]: https://github.com/bohdan-strilets/kus/commit/be4e0826707b842a71b6086181fe9d4d3113e528
[bcaf8df]: https://github.com/bohdan-strilets/kus/commit/bcaf8df157742391c96d122a9b3638009ac26cb3
[79b513a]: https://github.com/bohdan-strilets/kus/commit/79b513a8601df0264c9ad1ed4cf3981572071850
[2c5f417]: https://github.com/bohdan-strilets/kus/commit/2c5f4170e237d3405d76bd06b1eab0eb71bd626c
[1a5afd0]: https://github.com/bohdan-strilets/kus/commit/1a5afd0ac8a050850228149e5a2e8ba8ed35ad23
[e4861eb]: https://github.com/bohdan-strilets/kus/commit/e4861eb2672a3b399b3cb0206d498eeee04de89c
[9844536]: https://github.com/bohdan-strilets/kus/commit/9844536f11985741187db960219331ae41988c43
[c0d47d2]: https://github.com/bohdan-strilets/kus/commit/c0d47d22ae54d69ee3b4b79fcb59510ae3e4dc36
[2caafc7]: https://github.com/bohdan-strilets/kus/commit/2caafc7f0396ed26ee94297add9ae484ba78bba7
[fe88f81]: https://github.com/bohdan-strilets/kus/commit/fe88f8133e1458bbd97baef7eb51f2c3a468918e
[2843d76]: https://github.com/bohdan-strilets/kus/commit/2843d7671ad0f826e73364acab47e1e63648bdf6
[8adeea6]: https://github.com/bohdan-strilets/kus/commit/8adeea61c4c352fd71da14a07ab145ad075a197e
[79a499e]: https://github.com/bohdan-strilets/kus/commit/79a499ed84c17bba02b039e4d0014044f9e6b905
[5d500bd]: https://github.com/bohdan-strilets/kus/commit/5d500bd312dceaf6c8c4e497b670447678e5c5b0
[8c1de34]: https://github.com/bohdan-strilets/kus/commit/8c1de3402bf65e29ff73ebdbff871c02583130a5
[84eab64]: https://github.com/bohdan-strilets/kus/commit/84eab649f893b7c6be4360313ecb3b9886335db2
[3a054aa]: https://github.com/bohdan-strilets/kus/commit/3a054aae5b93e5d2baccc6fe905f65bb79bc301f
[aa23cb4]: https://github.com/bohdan-strilets/kus/commit/aa23cb4b3b034d52ed2338c3ea201abd5d0d9e7d
[0.4.0]: https://github.com/bohdan-strilets/kus/compare/v0.3.1...v0.4.0
[ad922dd]: https://github.com/bohdan-strilets/kus/commit/ad922dd3b587f9a6f0bf976c1d98165120caa1f8
[db239b6]: https://github.com/bohdan-strilets/kus/commit/db239b6be2f3ba6780a0db2815ff354c5b0b1237
[c788432]: https://github.com/bohdan-strilets/kus/commit/c788432b8a538eef96f2778367222e8fc0361e14
[279739a]: https://github.com/bohdan-strilets/kus/commit/279739af62a7da28a6b202a72aa299aed2c659a8
[f06b7ff]: https://github.com/bohdan-strilets/kus/commit/f06b7ffa090095e1a34cf7b4a90dde22599f267b
[4212861]: https://github.com/bohdan-strilets/kus/commit/42128610a36d02cdb13f103a494d7ec39acb5a46
[6e5c3a0]: https://github.com/bohdan-strilets/kus/commit/6e5c3a06d45b8b51a8cf532be96fe5bed3df7769
[a6cb8ae]: https://github.com/bohdan-strilets/kus/commit/a6cb8ae272815692fef8403a100d75eefdc8616e
[0.3.1]: https://github.com/bohdan-strilets/kus/compare/v0.3.0...v0.3.1
[57772fe]: https://github.com/bohdan-strilets/kus/commit/57772feea55a7b1b2774932664eb96b1d3234d5d
[0.3.0]: https://github.com/bohdan-strilets/kus/compare/v0.2.2...v0.3.0
[9287baa]: https://github.com/bohdan-strilets/kus/commit/9287baa8b63eaa64ce02f58ac66ba87610f5d112
[9b60374]: https://github.com/bohdan-strilets/kus/commit/9b603743f718e799ce6b557ff661f14fecc3c7d1
[ef4bb98]: https://github.com/bohdan-strilets/kus/commit/ef4bb98356eb8a46145f98122dd8b1a2de3c65f9
[0a29064]: https://github.com/bohdan-strilets/kus/commit/0a29064fd887eff06a0f4390ff29e76b3146ddd0
[74cb513]: https://github.com/bohdan-strilets/kus/commit/74cb5131ef8566c3921cad57a1a71d3da0b61a71
[ebcad96]: https://github.com/bohdan-strilets/kus/commit/ebcad96e4fc91d3a3ebab16d6098a771d10b3c14
[2976c7a]: https://github.com/bohdan-strilets/kus/commit/2976c7af58d08679e37c133b797aea261ae5a2cc
[bb32583]: https://github.com/bohdan-strilets/kus/commit/bb325835e08caa1b415556d281d2af6b706d322d
[f3e4ebb]: https://github.com/bohdan-strilets/kus/commit/f3e4ebb2fa8d651e454d4b1806279bf6b59670b8
[527efe2]: https://github.com/bohdan-strilets/kus/commit/527efe237299ebb74156668d520eb2c768420668
[72566a9]: https://github.com/bohdan-strilets/kus/commit/72566a9a99eeb06effd5d398e09fa080ba109a8e
[30873de]: https://github.com/bohdan-strilets/kus/commit/30873de814fb1bf4f206b67a54fa5111b198c9c0
[0.2.2]: https://github.com/bohdan-strilets/kus/compare/v0.2.1...v0.2.2
[4f65daf]: https://github.com/bohdan-strilets/kus/commit/4f65dafc15d9012d9ec776afd4ceaa535f15151b
[f8bb810]: https://github.com/bohdan-strilets/kus/commit/f8bb81040677e24d44fcd449218286f4a04babaa
[18570d0]: https://github.com/bohdan-strilets/kus/commit/18570d06389fd7a1da18507e9ef1e21719b4909c
[0.2.1]: https://github.com/bohdan-strilets/kus/compare/v0.2.0...v0.2.1
[e713895]: https://github.com/bohdan-strilets/kus/commit/e713895886266b251db80bea52145d44e7e8b7c2
[b1fedb6]: https://github.com/bohdan-strilets/kus/commit/b1fedb65cb0642daef17d1286aec51190a64efa0
[c4d7e50]: https://github.com/bohdan-strilets/kus/commit/c4d7e50397b75b95d0a853f6c48fc5013101af37
[be685d9]: https://github.com/bohdan-strilets/kus/commit/be685d95fee4a445f525ebdafb61e9db2dd0e1b5
[150985a]: https://github.com/bohdan-strilets/kus/commit/150985a270e37cf7a6f2be19e3fd6d7c01a4d288
