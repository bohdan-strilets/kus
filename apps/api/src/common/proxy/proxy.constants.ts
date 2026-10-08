/** Set by the Vercel rewrite from the API_PROXY_SECRET env var (apps/web/vercel.json). */
export const PROXY_SECRET_HEADER = 'x-kus-proxy-secret'

/**
 * The client IP as Vercel saw it. Vercel overwrites it on every request, so a client can't forge
 * it — but only through Vercel: read it only once the proxy secret proved the request came that way.
 */
export const CLIENT_IP_HEADER = 'x-vercel-forwarded-for'
