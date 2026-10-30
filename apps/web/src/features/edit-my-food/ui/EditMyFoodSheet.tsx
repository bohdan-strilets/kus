import type { MyFoodResponse } from '@kus/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BaseBottomSheet } from '@/shared/ui'

import { useMyFoodActions } from '../model/use-my-food-actions'
import { EditMyFoodForm } from './EditMyFoodForm'

interface EditMyFoodSheetProps {
	/** The product being edited; null — the sheet is closed. */
	food: MyFoodResponse | null
	onClose: () => void
}

/** mockups/memory-products.html «Редагування»: opened from a row of «Пам'ять → Продукти». */
export const EditMyFoodSheet = ({ food, onClose }: EditMyFoodSheetProps) => {
	const { t } = useTranslation()
	const actions = useMyFoodActions({ onGone: onClose })
	// the sheet slides out with its content, so the last product stays until it is gone
	const [shown, setShown] = useState<MyFoodResponse | null>(food)
	if (food !== null && food !== shown) setShown(food)

	return (
		<BaseBottomSheet
			isOpen={food !== null}
			onOpenChange={(isOpen) => {
				if (!isOpen) onClose()
			}}
			title={t('editMyFood.title')}
		>
			{shown && <EditMyFoodForm key={shown.id} food={shown} actions={actions} onDone={onClose} />}
		</BaseBottomSheet>
	)
}
