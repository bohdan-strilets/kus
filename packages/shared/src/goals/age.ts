/**
 * The profile stores a birth year and the API talks in ages (CLAUDE.md: the year never leaves the
 * backend). Both directions use the same current year, so an age saved today reads back the same.
 */
export const getBirthYearFromAge = (age: number, currentYear: number): number => currentYear - age

export const getAgeFromBirthYear = (birthYear: number, currentYear: number): number =>
	currentYear - birthYear
