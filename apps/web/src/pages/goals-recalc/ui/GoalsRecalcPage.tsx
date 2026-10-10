import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import {
	getGoalWarningMessage,
	getPlanSteps,
	goalsPreviewQueryOptions,
	isProfileIncompleteError,
	PlanCard,
	PlanHowSheet,
} from '@/entities/goals'
import { KusikRow } from '@/entities/message'
import { profileQueryOptions } from '@/entities/profile'
import {
	getPaceIcon,
	getRecalcBubbleText,
	getRecalcPaceText,
	getWasText,
	toPlanProfile,
	useSaveCalculatedGoals,
} from '@/features/recalc-goals'
import { translateApiMessage } from '@/shared/api'
import { ROUTES } from '@/shared/config'
import { Button, InlineError, ScreenHeader, Text } from '@/shared/ui'

import { ProfileIncompleteRedirect } from './ProfileIncompleteRedirect'
import { RecalcBubble } from './RecalcBubble'
import { RecalcSkeleton } from './RecalcSkeleton'

export const GoalsRecalcPage = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const [isHowOpen, setIsHowOpen] = useState(false)
	const { save, isSaving } = useSaveCalculatedGoals()
	const profileQuery = useQuery(profileQueryOptions)
	const previewQuery = useQuery(goalsPreviewQueryOptions)

	const preview = previewQuery.data
	const profileResponse = profileQuery.data
	const planProfile = profileResponse ? toPlanProfile(profileResponse) : null

	const renderContent = () => {
		if (isProfileIncompleteError(previewQuery.error)) return <ProfileIncompleteRedirect />
		if (previewQuery.isError || profileQuery.isError) {
			return (
				<InlineError
					message={t('profile.loadError')}
					onRetry={() => {
						void previewQuery.refetch()
						void profileQuery.refetch()
					}}
				/>
			)
		}
		if (!preview || !profileResponse || !planProfile) return <RecalcSkeleton />

		const { goalType, weightKg, activityLevel } = planProfile
		const pace = preview.appliedPaceKgPerWeek
		return (
			<>
				<KusikRow>
					<RecalcBubble>
						<Text as="p" className="px-3.5 pt-3.5 pb-2.5">
							{getRecalcBubbleText({ weightKg, activityLevel, goalType, pace }, t)}
						</Text>
						<div className="mx-2.5">
							<PlanCard
								heading={t('recalcGoals.newGoals')}
								kcal={preview.kcal}
								proteinG={preview.proteinG}
								carbsG={preview.carbsG}
								fatG={preview.fatG}
								paceText={getRecalcPaceText(
									{
										goalType,
										pace,
										targetWeightKg: profileResponse.profile.targetWeightKg,
										weightKg,
										etaWeeks: preview.etaWeeks,
									},
									t,
								)}
								paceIcon={getPaceIcon(goalType)}
							>
								{preview.current && (
									<Text as="span" variant="small" tone="primaryDeep">
										{getWasText(preview.current, t)}
									</Text>
								)}
								{preview.warnings.map((warning) => (
									<Text key={warning} as="span" variant="small" tone="primaryDeep">
										{translateApiMessage(t, getGoalWarningMessage(warning, preview))}
									</Text>
								))}
							</PlanCard>
						</div>
						<Button
							variant="text"
							size="sm"
							className="mx-3.5 mt-1.5 min-h-9 self-start"
							onClick={() => {
								setIsHowOpen(true)
							}}
						>
							{t('recalcGoals.how')}
						</Button>
						<div className="grid grid-cols-[1fr_auto] gap-2 px-3.5 pt-2 pb-3.5">
							<Button isLoading={isSaving} loadingText={t('recalcGoals.saving')} onClick={save}>
								{t('recalcGoals.save')}
							</Button>
							<Button
								variant="secondary"
								onClick={() => {
									void navigate(ROUTES.profile)
								}}
							>
								{t('recalcGoals.cancel')}
							</Button>
						</div>
					</RecalcBubble>
				</KusikRow>
				<PlanHowSheet
					isOpen={isHowOpen}
					onOpenChange={setIsHowOpen}
					steps={getPlanSteps({ preview, profile: planProfile, t })}
				/>
			</>
		)
	}

	return (
		<>
			<ScreenHeader title={t('recalcGoals.title')} backTo={ROUTES.profile} />
			<main className="flex flex-1 flex-col justify-center gap-2.5 px-gutter py-2.5">
				{renderContent()}
			</main>
			<div className="h-6 flex-none" />
		</>
	)
}
