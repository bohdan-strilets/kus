import 'dotenv/config'

import { defineConfig } from 'prisma/config'

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: {
		path: 'prisma/migrations',
		seed: 'tsx prisma/seed.ts',
	},
	// `prisma generate` doesn't need a database, so it must work without DATABASE_URL (CI, fresh clone)
	datasource: {
		url: process.env.DATABASE_URL ?? '',
	},
})
