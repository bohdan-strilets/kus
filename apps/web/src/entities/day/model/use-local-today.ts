import { useLocalDate } from '@/shared/lib'

/**
 * Today (`YYYY-MM-DD`) in the user's timezone — the day the API sums. Moves on at midnight while
 * the tab stays open and when it comes back from the background.
 */
export const useLocalToday = (timeZone: string): string => useLocalDate(timeZone)
