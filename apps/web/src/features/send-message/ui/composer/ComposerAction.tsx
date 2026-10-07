import { useTranslation } from 'react-i18next'

import { cn } from '@/shared/lib'
import { Icon, ICON_SIZE, IconButton } from '@/shared/ui'

interface ComposerActionProps {
	/** There is text to send: the mic becomes «надіслати». */
	canSend: boolean
	onVoiceStart?: () => void
}

// --duration-fast drops to 0 under prefers-reduced-motion (tokens.css), so no animation there
const ICON_LAYER_CLASS =
	'absolute inset-0 m-auto transition-opacity duration-(--duration-fast) ease-out'

/**
 * The single right-hand slot of docs InputBar: one primary 42px button (≥ 44 tap area) that is
 * the mic while the field is empty and «надіслати» once there is text. The button itself stays,
 * so its width and the focus never jump; only the icons cross-fade.
 */
export const ComposerAction = ({ canSend, onVoiceStart }: ComposerActionProps) => {
	const { t } = useTranslation()

	return (
		<IconButton
			type={canSend ? 'submit' : 'button'}
			variant="primary"
			size="sm"
			label={canSend ? t('composer.send') : t('composer.voice')}
			onClick={canSend ? undefined : onVoiceStart}
		>
			<span className="relative size-4.5">
				<Icon
					name="mic"
					size={ICON_SIZE.control}
					className={cn(ICON_LAYER_CLASS, canSend ? 'opacity-0' : 'opacity-100')}
				/>
				<Icon
					name="send"
					size={ICON_SIZE.control}
					className={cn(ICON_LAYER_CLASS, canSend ? 'opacity-100' : 'opacity-0')}
				/>
			</span>
		</IconButton>
	)
}
