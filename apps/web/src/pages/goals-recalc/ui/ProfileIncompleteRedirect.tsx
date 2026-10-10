import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { ROUTES } from '@/shared/config'
import { useToast } from '@/shared/ui'

/** Nothing to recalculate yet: say why once and send the user to «Мої дані». */
export const ProfileIncompleteRedirect = () => {
	const { t } = useTranslation()
	const toast = useToast()
	const navigate = useNavigate()
	const isHandledRef = useRef(false)

	useEffect(() => {
		// dev StrictMode runs effects twice; the toast must show once
		if (isHandledRef.current) return
		isHandledRef.current = true
		toast.show(t('errors.api.PROFILE_INCOMPLETE'))
		void navigate(ROUTES.profileData, { replace: true })
	}, [toast, t, navigate])

	return null
}
