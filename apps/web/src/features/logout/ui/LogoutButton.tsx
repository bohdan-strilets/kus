import { Button } from '@/shared/ui'

import { useLogout } from '../model/use-logout'

export interface LogoutButtonProps {
	label: string
	/** danger: «Вийти з акаунту» in the profile; plain: «Вийти» on the account-restore screen. */
	tone?: 'danger' | 'plain'
}

const VARIANT_BY_TONE = { danger: 'textDanger', plain: 'textPlain' } as const

export const LogoutButton = ({ label, tone = 'danger' }: LogoutButtonProps) => {
	const { logout, isPending } = useLogout()

	return (
		<Button
			variant={VARIANT_BY_TONE[tone]}
			isFullWidth={tone === 'plain'}
			className={tone === 'danger' ? 'self-center' : undefined}
			isLoading={isPending}
			onClick={logout}
		>
			{label}
		</Button>
	)
}
