import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { ROUTES } from '@/shared/config'

import { useComposerDraftStore } from './composer-draft-store'

/**
 * «Змінити склад у чаті» on a recipe: the chat opens with «Зміни склад «{name}»: » at the start of
 * the field. It is a plain message (no intent): the model saves the recipe under the same name and
 * the backend replaces the old one. A draft the user already has stays after the prefix, and the
 * cursor sits right behind the prefix; a draft that already starts with it is left as it is.
 */
export const useStartRecipeEditDraft = (): ((recipeName: string) => void) => {
	const { t } = useTranslation()
	const navigate = useNavigate()

	return (recipeName) => {
		const { text, setText, requestFocus } = useComposerDraftStore.getState()
		const prefix = t('chat.editRecipe.prefill', { name: recipeName })
		if (!text.startsWith(prefix)) setText(`${prefix}${text.trim() === '' ? '' : text}`)
		requestFocus(prefix.length)
		void navigate(ROUTES.chat)
	}
}
