const LOCALE = 'uk-UA'

/** «1 370»: rounded, with the Ukrainian thousands separator. */
export const formatInteger = (value: number): string => Math.round(value).toLocaleString(LOCALE)
