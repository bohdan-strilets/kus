import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

import { useToast } from './use-toast'

/** Toasts don't follow the user to another screen: closes them all on a route change. */
export const ToastRouteReset = () => {
	const { dismissAll } = useToast()
	const { pathname } = useLocation()
	const previousPathname = useRef(pathname)

	useEffect(() => {
		if (previousPathname.current === pathname) return
		previousPathname.current = pathname
		dismissAll()
	}, [pathname, dismissAll])

	return null
}
