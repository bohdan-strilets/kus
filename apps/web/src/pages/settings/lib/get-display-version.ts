/** «0.1.0» → «0.1»: the settings line shows major.minor only. */
export const getDisplayVersion = (version: string): string =>
	version.split('.').slice(0, 2).join('.')
