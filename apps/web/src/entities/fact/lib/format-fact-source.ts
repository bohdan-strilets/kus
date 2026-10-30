import type { FactResponse } from '@kus/shared'
import type { TFunction } from 'i18next'

import { formatDayMonth } from '@/shared/lib'

/** «з чату, 12 жовтня»: every fact comes from the chat. */
export const formatFactSource = (fact: Pick<FactResponse, 'createdAt'>, t: TFunction): string =>
	t('fact.source', { date: formatDayMonth(new Date(fact.createdAt)) })
