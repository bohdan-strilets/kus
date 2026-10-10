import { motion } from 'motion/react'
import { Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'

import { tabContentVariants } from '@/shared/lib'
import { AppLayout } from '@/shared/ui'

import { RouteLoader } from './RouteLoader'

/**
 * Pushed screens (profile and what opens from it): no bottom nav, as in the mockups. The entrance
 * is «8 px from the right + opacity, base» from design/docs/motion.md — there is no separate stack
 * preset, and tabContentVariants is the same motion. Reduced motion comes from the root MotionConfig.
 */
export const StackLayout = () => {
	const { pathname } = useLocation()

	return (
		<AppLayout>
			<Suspense fallback={<RouteLoader />}>
				<motion.div
					key={pathname}
					variants={tabContentVariants}
					initial="hidden"
					animate="visible"
					className="flex min-h-0 flex-1 flex-col"
				>
					<Outlet />
				</motion.div>
			</Suspense>
		</AppLayout>
	)
}
