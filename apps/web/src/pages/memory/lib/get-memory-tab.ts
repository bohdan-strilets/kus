import { MEMORY_FACTS_TAB } from '@/shared/config'

import type { MemoryTab } from './memory-tab.types'

/** The tab from `?tab=`: only «facts» opens «Про тебе»; anything else (or nothing) is «Продукти». */
export const getMemoryTab = (param: string | null): MemoryTab =>
	param === MEMORY_FACTS_TAB ? 'facts' : 'products'
