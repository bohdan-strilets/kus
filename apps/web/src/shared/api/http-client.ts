import axios from 'axios'

import { env } from '../config'

export const httpClient = axios.create({
	baseURL: env.VITE_API_URL,
	// auth cookies are httpOnly and set by our own API only
	withCredentials: true,
})
