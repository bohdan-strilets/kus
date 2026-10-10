import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const STORAGE_KEY = 'kusik-sound-settings'

const createMemoryStorage = (): Storage => {
	const items = new Map<string, string>()
	return {
		get length() {
			return items.size
		},
		clear: () => {
			items.clear()
		},
		getItem: (key) => items.get(key) ?? null,
		key: (index) => [...items.keys()][index] ?? null,
		removeItem: (key) => {
			items.delete(key)
		},
		setItem: (key, value) => {
			items.set(key, value)
		},
	}
}

// the store reads localStorage when the module loads, so every test imports it afresh
const loadStore = async () => {
	vi.resetModules()
	const { useSoundSettingsStore } = await import('./sound-settings-store')
	return useSoundSettingsStore
}

describe('useSoundSettingsStore', () => {
	let storage: Storage

	beforeEach(() => {
		storage = createMemoryStorage()
		vi.stubGlobal('localStorage', storage)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('has sound and haptics on by default', async () => {
		const store = await loadStore()
		expect(store.getState().isSoundOn).toBe(true)
		expect(store.getState().isHapticsOn).toBe(true)
	})

	it('turns sound off without touching haptics', async () => {
		const store = await loadStore()
		store.getState().setSoundOn(false)
		expect(store.getState().isSoundOn).toBe(false)
		expect(store.getState().isHapticsOn).toBe(true)
	})

	it('turns haptics off without touching sound', async () => {
		const store = await loadStore()
		store.getState().setHapticsOn(false)
		expect(store.getState().isHapticsOn).toBe(false)
		expect(store.getState().isSoundOn).toBe(true)
	})

	it('persists the switches under kusik-sound-settings and restores them', async () => {
		const store = await loadStore()
		store.getState().setSoundOn(false)

		const saved: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null')
		expect(saved).toMatchObject({ state: { isSoundOn: false, isHapticsOn: true } })

		const restored = await loadStore()
		expect(restored.getState().isSoundOn).toBe(false)
	})
})
