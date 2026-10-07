import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { endSession } from '@/entities/session'
import { isUnauthorizedError } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { useToast } from '@/shared/ui'

import { logout } from '../api/logout'

/**
 * The httpOnly cookies can only be cleared by the API, so a logout that didn't reach it changes
 * nothing: the user stays in the app and can try again. A 401 means there was no session anyway.
 */
export const useLogout = () => {
	const { t } = useTranslation()
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const toast = useToast()

	const leave = (): void => {
		// leave first: the session guard must not remember this page as «come back here»
		void navigate(ROUTES.login, { replace: true })
		endSession(queryClient)
	}

	const mutation = useMutation({
		mutationFn: logout,
		onSuccess: leave,
		onError: (error) => {
			if (isUnauthorizedError(error)) {
				leave()
				return
			}
			toast.show(t('auth.logoutFailed'))
		},
	})

	return {
		logout: () => {
			mutation.mutate()
		},
		isPending: mutation.isPending,
	}
}
