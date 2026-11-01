import { TRAINING_EQUIPMENT_NONE } from '@kus/shared'

/** One tap on the equipment question: «Нічого» excludes the rest, any other option drops «Нічого». */
export const toggleEquipment = (selected: readonly string[], value: string): string[] => {
	if (selected.includes(value)) return selected.filter((item) => item !== value)
	if (value === TRAINING_EQUIPMENT_NONE) return [value]
	return [...selected.filter((item) => item !== TRAINING_EQUIPMENT_NONE), value]
}
