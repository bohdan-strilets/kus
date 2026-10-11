export type ReleaseNote = {
	version: string
	date: string
	items: string[]
}

/**
 * What changed for the user, in their words: no routes, hooks or history entries. Newest first.
 * Not shown anywhere yet; the full technical list is CHANGELOG.md at the repo root.
 */
export const RELEASE_NOTES: ReleaseNote[] = [
	{
		version: '0.2.2',
		date: '2026-10-11',
		items: [
			'Хрускіт «кусь» на iPhone тепер чути з першого ж запису.',
			'Кільце калорій і смужки макросів не перемальовуються з нуля щоразу, коли повертаєшся на «Сьогодні»: рухаються лише тоді, коли щось змінилось.',
			'У налаштуваннях видно повний номер версії.',
		],
	},
	{
		version: '0.2.1',
		date: '2026-10-11',
		items: [
			'«Назад» у профілі веде саме туди, звідки відкрито екран: у чат або в «Сьогодні».',
			'Свайп назад на iPhone більше не повертає щойно закритий екран.',
			'Вкладки внизу перемикаються, як у звичайних застосунках: «Назад» не гортає їх по черзі.',
		],
	},
]
