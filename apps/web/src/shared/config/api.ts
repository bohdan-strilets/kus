/**
 * Same origin everywhere: the Vite dev proxy (vite.config.ts) and the Vercel rewrite forward
 * /api to the API, so auth cookies stay first-party and no CORS is involved (docs/architecture.md).
 */
export const API_BASE_URL = '/api/v1'
