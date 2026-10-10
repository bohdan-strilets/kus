import { useTranslation } from 'react-i18next'

import { useSoundSettingsStore } from '@/shared/lib'
import { ListRow, RowGroup, Switch } from '@/shared/ui'

import { canVibrate } from '../lib/can-vibrate'

export const SoundSettingsRows = () => {
	const { t } = useTranslation()
	const isSoundOn = useSoundSettingsStore((state) => state.isSoundOn)
	const isHapticsOn = useSoundSettingsStore((state) => state.isHapticsOn)
	const setSoundOn = useSoundSettingsStore((state) => state.setSoundOn)
	const setHapticsOn = useSoundSettingsStore((state) => state.setHapticsOn)

	return (
		<RowGroup>
			<ListRow
				label={t('settings.sound')}
				trailing={
					<Switch isChecked={isSoundOn} onCheckedChange={setSoundOn} label={t('settings.sound')} />
				}
			/>
			{canVibrate() && (
				<ListRow
					label={t('settings.vibration')}
					trailing={
						<Switch
							isChecked={isHapticsOn}
							onCheckedChange={setHapticsOn}
							label={t('settings.vibration')}
						/>
					}
				/>
			)}
		</RowGroup>
	)
}
