import { RegisterForm, useRegisterForm } from '@/features/authenticate'
import { Hamster, Wordmark } from '@/shared/ui'

import { AuthLayout } from './AuthLayout'

const HAMSTER_SIZE = 64
const WORDMARK_SIZE = 30

/** /register — auth-register: a compact header in a row, so the form fits on one screen. */
export const RegisterPage = () => {
	const state = useRegisterForm()

	return (
		<AuthLayout
			header={
				<div className="flex items-center gap-2.5">
					<Hamster mood="wave" size={HAMSTER_SIZE} />
					<Wordmark size={WORDMARK_SIZE} />
				</div>
			}
		>
			<RegisterForm state={state} />
		</AuthLayout>
	)
}
