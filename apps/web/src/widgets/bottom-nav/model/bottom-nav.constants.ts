import { EASE, TRANSITION } from '@/shared/lib'

/** Shared layoutId: the active pill slides from tab to tab (docs BottomNav). */
export const NAV_PILL_LAYOUT_ID = 'bottom-nav-pill'

/** docs: the pill moves with TRANSITION.slow + spring. */
export const NAV_PILL_TRANSITION = { ...TRANSITION.slow, ease: EASE.spring }
