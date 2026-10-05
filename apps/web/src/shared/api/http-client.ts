import axios from 'axios'

import { env } from '../config'

// a hanging mobile connection must end in the error state, not an endless skeleton
const REQUEST_TIMEOUT_MS = 15_000

export const httpClient = axios.create({
	baseURL: env.VITE_API_URL,
	timeout: REQUEST_TIMEOUT_MS,
	// auth cookies are httpOnly and set by our own API only
	withCredentials: true,
})
