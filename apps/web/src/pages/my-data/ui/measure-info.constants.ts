import type { ParseKeys } from 'i18next'

import type { IconName } from '@/shared/ui'

export interface MeasureInfoSection {
	iconName: IconName
	titleKey: ParseKeys
	itemKeys: ParseKeys[]
}

export const MEASURE_INFO_SECTIONS: MeasureInfoSection[] = [
	{
		iconName: 'info',
		titleKey: 'measureInfo.why.title',
		itemKeys: [
			'measureInfo.why.items.item1',
			'measureInfo.why.items.item2',
			'measureInfo.why.items.item3',
		],
	},
	{
		iconName: 'scale',
		titleKey: 'measureInfo.weigh.title',
		itemKeys: [
			'measureInfo.weigh.items.item1',
			'measureInfo.weigh.items.item2',
			'measureInfo.weigh.items.item3',
		],
	},
	{
		iconName: 'tape',
		titleKey: 'measureInfo.waist.title',
		itemKeys: [
			'measureInfo.waist.items.item1',
			'measureInfo.waist.items.item2',
			'measureInfo.waist.items.item3',
			'measureInfo.waist.items.item4',
		],
	},
]
