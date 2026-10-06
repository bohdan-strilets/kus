import { useContext } from 'react'

import { type ToastApi, ToastContext } from './toast.context'

export const useToast = (): ToastApi => {
	const api = useContext(ToastContext)
	if (!api) throw new Error('useToast must be used inside <ToastProvider>')
	return api
}
