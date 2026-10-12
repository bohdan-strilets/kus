# Changelog

All notable changes to Kusik are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/bohdan-strilets/kus/compare/v0.3.1...HEAD
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
