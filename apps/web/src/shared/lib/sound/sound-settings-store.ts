import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

interface SoundSettingsState {
	isSoundOn: boolean
	isHapticsOn: boolean
	setSoundOn: (value: boolean) => void
	setHapticsOn: (value: boolean) => void
}

export const SOUND_SETTINGS_STORAGE_KEY = 'kusik-sound-settings'
const SOUND_SETTINGS_STORAGE_VERSION = 1

/** «Налаштування → Звуки й вібрація»: on by default (design/docs/sounds.md), kept on this device. */
export const useSoundSettingsStore = create<SoundSettingsState>()(
	persist(
		(set) => ({
			isSoundOn: true,
			isHapticsOn: true,
			setSoundOn: (value) => {
				set({ isSoundOn: value })
			},
			setHapticsOn: (value) => {
				set({ isHapticsOn: value })
			},
		}),
		{
			name: SOUND_SETTINGS_STORAGE_KEY,
			version: SOUND_SETTINGS_STORAGE_VERSION,
			storage: createJSONStorage(() => localStorage),
			partialize: ({ isSoundOn, isHapticsOn }) => ({ isSoundOn, isHapticsOn }),
		},
	),
)
