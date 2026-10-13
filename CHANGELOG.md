# Changelog

All notable changes to Kusik are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/bohdan-strilets/kus/compare/v0.5.1...HEAD
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
