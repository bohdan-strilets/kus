import type { PROGRESS_RANGES } from '@kus/shared'

/** 7, 30 or 90 days: what the switch over weight and waist can ask for. */
export type ProgressRange = (typeof PROGRESS_RANGES)[number]
