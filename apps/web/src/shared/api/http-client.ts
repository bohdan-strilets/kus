import axios from 'axios'

import { API_BASE_URL } from '../config'

// a hanging mobile connection must end in the error state, not an endless skeleton
const REQUEST_TIMEOUT_MS = 15_000

// same origin (dev proxy / Vercel rewrite): the httpOnly auth cookies go along without
// withCredentials, and no token ever passes through JS
export const httpClient = axios.create({
	baseURL: API_BASE_URL,
	timeout: REQUEST_TIMEOUT_MS,
})
