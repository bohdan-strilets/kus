import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'

import { BottomNav } from '@/widgets/bottom-nav'

export const RootLayout = () => {
	const { t } = useTranslation()

	return (
		<div className="mx-auto flex min-h-dvh max-w-lg flex-col">
			{/* room for the fixed bottom nav */}
			<main className="flex-1 pb-24">
				<Suspense fallback={<p className="px-4 pt-6 text-muted">{t('common.loading')}</p>}>
					<Outlet />
				</Suspense>
			</main>
			<BottomNav />
		</div>
	)
}
