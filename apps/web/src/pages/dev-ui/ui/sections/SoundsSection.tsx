import { useTranslation } from 'react-i18next'

import { playSound, type SoundName, unlockSound } from '@/shared/lib'

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
