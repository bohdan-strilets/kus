# Changelog

All notable changes to Kusik are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.1]: https://github.com/bohdan-strilets/kus/compare/v0.2.0...v0.2.1
[e713895]: https://github.com/bohdan-strilets/kus/commit/e713895886266b251db80bea52145d44e7e8b7c2
[b1fedb6]: https://github.com/bohdan-strilets/kus/commit/b1fedb65cb0642daef17d1286aec51190a64efa0
[c4d7e50]: https://github.com/bohdan-strilets/kus/commit/c4d7e50397b75b95d0a853f6c48fc5013101af37
[be685d9]: https://github.com/bohdan-strilets/kus/commit/be685d95fee4a445f525ebdafb61e9db2dd0e1b5
[150985a]: https://github.com/bohdan-strilets/kus/commit/150985a270e37cf7a6f2be19e3fd6d7c01a4d288
