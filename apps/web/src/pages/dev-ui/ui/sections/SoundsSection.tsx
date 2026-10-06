import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import {
	configureSound,
	DEFAULT_SOUND_SETTINGS,
	playSound,
	type SoundName,
	unlockSound,
} from '@/shared/lib'

import { DemoButton } from '../DemoButton'
import { DevSection } from '../DevSection'

const SOUND_NAMES: readonly SoundName[] = [
	'kusik',
	'goal',
	'achieve',
	'saved',
	'clarify',
	'oops',
	'photoFail',
	'micStart',
	'micStop',
	'remind',
]

export const SoundsSection = () => {
	const { t } = useTranslation()

	// sound is opt-in in the app; this page turns it on only while it is open
	useEffect(() => {
		configureSound({ sound: true, haptics: true })
		return () => {
			configureSound(DEFAULT_SOUND_SETTINGS)
		}
	}, [])

	return (
		<DevSection title={t('devUi.sections.sounds')} hint={t('devUi.soundsHint')}>
			<div className="grid grid-cols-2 gap-2">
				{SOUND_NAMES.map((name) => (
					<DemoButton
						key={name}
						label={t(`devUi.sound.${name}`)}
						onClick={() => {
							unlockSound()
							playSound(name)
						}}
					/>
				))}
			</div>
		</DevSection>
	)
}
