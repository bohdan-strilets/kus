import type { ParseKeys } from 'i18next'

export interface MeasureInfoSection {
	titleKey: ParseKeys
	itemKeys: ParseKeys[]
}

export const MEASURE_INFO_SECTIONS: MeasureInfoSection[] = [
	{
		titleKey: 'measureInfo.why.title',
		itemKeys: [
			'measureInfo.why.items.item1',
			'measureInfo.why.items.item2',
			'measureInfo.why.items.item3',
		],
	},
	{
		titleKey: 'measureInfo.weigh.title',
		itemKeys: [
			'measureInfo.weigh.items.item1',
			'measureInfo.weigh.items.item2',
			'measureInfo.weigh.items.item3',
		],
	},
	{
		titleKey: 'measureInfo.waist.title',
		itemKeys: [
			'measureInfo.waist.items.item1',
			'measureInfo.waist.items.item2',
			'measureInfo.waist.items.item3',
			'measureInfo.waist.items.item4',
		],
	},
]
