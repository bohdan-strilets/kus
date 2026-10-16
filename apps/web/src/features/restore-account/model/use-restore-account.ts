import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { setSessionUser } from '@/entities/session'
import { getApiError } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { useToast } from '@/shared/ui'

import { postRestoreAccount } from '../api/post-restore-account'
import { getRestoreErrorKey } from '../lib/get-restore-error-key'

/** The restored user (no more pendingDeletion) goes into the session cache, then into the app. */
export const useRestoreAccount = () => {
	const { t } = useTranslation()
	const toast = useToast()
	const queryClient = useQueryClient()
	const navigate = useNavigate()

	const mutation = useMutation({
		mutationFn: postRestoreAccount,
		onSuccess: (user) => {
			setSessionUser(queryClient, user)
			void navigate(ROUTES.chat, { replace: true })
		},
		onError: (error) => {
			toast.show(t(getRestoreErrorKey(getApiError(error))))
		},
	})

	return {
		restore: () => {
			mutation.mutate()
		},
		isPending: mutation.isPending,
	}
}
