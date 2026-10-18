const DECIMAL_SEPARATOR = /[.,]/

/** Cuts the text after `maxDecimals` digits behind the first comma or dot, so «85,55» becomes «85,5». */
export const limitDecimals = (value: string, maxDecimals: number): string => {
	const separatorIndex = value.search(DECIMAL_SEPARATOR)
	if (separatorIndex === -1) return value
	return value.slice(0, separatorIndex + 1 + maxDecimals)
}
