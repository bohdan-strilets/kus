import type { AchievementResponse } from '@kus/shared'

import type { Achievement } from '../../generated/prisma/client'

export const toAchievementResponse = (row: Achievement): AchievementResponse => ({
	id: row.id,
	type: row.type,
	value: row.value,
	achievedAt: row.achievedAt.toISOString(),
})
