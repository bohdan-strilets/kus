import { useTranslation } from 'react-i18next'

import { Heading } from '@/shared/ui'

/** Placeholder: the real screen replaces it in a later step of stage 6B. */
export const ChangePasswordPage = () => {
	const { t } = useTranslation()

	return (
		<Heading as="h1" className="px-gutter pt-6">
			{t('changePassword.title')}
		</Heading>
	)
}
