// The walk back after logout may cross into an earlier document (the app was reloaded since):
// then history.go loads that page anew and the push of /login that drops the entries ahead never
// runs. This mark, set before the walk, lets the freshly started app finish it.

const PENDING_LOGIN_PUSH_KEY = 'kusik-logout-walk'

export const markPendingLoginPush = (): void => {
	try {
		sessionStorage.setItem(PENDING_LOGIN_PUSH_KEY, '1')
	} catch {
		// storage blocked: only the forward entries after a reload stay, the logout itself is done
	}
}

/** True once per mark: the caller pushes /login. */
export const consumePendingLoginPush = (): boolean => {
	try {
		const isPending = sessionStorage.getItem(PENDING_LOGIN_PUSH_KEY) !== null
		sessionStorage.removeItem(PENDING_LOGIN_PUSH_KEY)
		return isPending
	} catch {
		return false
	}
}
