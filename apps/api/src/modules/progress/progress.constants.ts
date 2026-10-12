/** Saturday and Sunday protein under this share of the weekday average flags the weekend. */
export const WEEKEND_PROTEIN_LOW_RATIO = 0.85

/** The week card and the insight always look at this many last days, whatever the range is. */
export const WEEK_DAYS = 7

/** Where the empty state is decided: the last 90 days, the longest range. */
export const EMPTY_STATE_WINDOW_DAYS = 90
/** Fewer days with food than this ... */
export const MIN_FOOD_DAYS_FOR_PROGRESS = 3
/** ... and fewer weigh-ins than this make the screen empty. */
export const MIN_WEIGHINGS_FOR_PROGRESS = 2

/** A weight older than this (days before today) says nothing about the pace of this week. */
export const WEEK_PACE_MAX_AGE_DAYS = 6

export const SATURDAY = 6
export const SUNDAY = 0
