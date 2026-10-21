export { detectGoalReached } from './lib/detect-goal-reached'
export {
	getStatsCardView,
	type StatsCardDayRow,
	type StatsCardView,
} from './lib/get-stats-card-view'
export { getDayProgress } from './lib/get-day-progress'
export { type DayStats, getDayStats } from './lib/get-day-stats'
export { type GaugeState, getGaugeState, type GaugeStatus } from './lib/get-gauge-state'
export {
	clearGoalCelebratedFlags,
	hasCelebratedGoal,
	markGoalCelebrated,
} from './lib/goal-celebrated-flag'
export {
	GOAL_ARM_WINDOW_MS,
	GOAL_PENDING_TTL_MS,
	type GoalCelebration,
	useGoalCelebrationStore,
} from './model/goal-celebration-store'
export {
	MACRO_ORDER,
	type MacroKey,
	type MacroProgress,
	type MacroProgressSet,
} from './model/macro.types'
export { CalorieGauge, type CalorieGaugeProps } from './ui/calorie-gauge/CalorieGauge'
export { CompactDayBar, type CompactDayBarProps } from './ui/compact-day-bar/CompactDayBar'
export { DayRecapCard, type DayRecapCardProps } from './ui/day-recap-card/DayRecapCard'
export { DayStatsCard, type DayStatsCardProps } from './ui/day-stats-card/DayStatsCard'
export { DaySummaryCard, type DaySummaryCardProps } from './ui/day-summary-card/DaySummaryCard'
export {
	COMPACT_GOAL_DISTANCE,
	DEFAULT_GOAL_PARTICLE_DISTANCE,
} from './ui/goal-celebration-frame/goal-celebration-frame.constants'
export {
	GoalCelebrationFrame,
	type GoalCelebrationFrameProps,
} from './ui/goal-celebration-frame/GoalCelebrationFrame'
export { MacroTile, type MacroTileProps } from './ui/macro-tile/MacroTile'
export { MacroTiles, type MacroTilesProps } from './ui/macro-tiles/MacroTiles'
export { StatsCard, type StatsCardProps } from './ui/stats-card/StatsCard'
export { SupportCard, type SupportCardProps } from './ui/support-card/SupportCard'
export type { DayStatus, WeekDay, WeekDayStatus } from './ui/week-strip/week-strip.types'
export { WeekStrip, type WeekStripProps } from './ui/week-strip/WeekStrip'
