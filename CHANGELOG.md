# Changelog

All notable changes to Kusik are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/bohdan-strilets/kus/compare/v0.2.2...HEAD
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
