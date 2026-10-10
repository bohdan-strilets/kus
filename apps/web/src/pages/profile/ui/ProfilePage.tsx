import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { GoalsTiles } from '@/entities/goals'
import { getGoalSubtitle, ProfileCard, profileQueryOptions } from '@/entities/profile'
import { useSessionUser } from '@/entities/session'
import { EditAddressSheet } from '@/features/edit-address'
import { EditGoalsSheet, toGoalValues } from '@/features/edit-goals'
import { LogoutButton } from '@/features/logout'
import { ROUTES } from '@/shared/config'
import {
	Button,
	Icon,
	ICON_SIZE,
	InlineError,
	ListRow,
	ListRowIcon,
	RowGroup,
	ScreenHeader,
	Skeleton,
	Surface,
	Text,
} from '@/shared/ui'

/** Behind the chat avatar (mockups/profile.html): who you are, the day's goals, the way on. */
export const ProfilePage = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const user = useSessionUser()
	const profileQuery = useQuery(profileQueryOptions)
	const [isAddressOpen, setIsAddressOpen] = useState(false)
	const [isGoalsOpen, setIsGoalsOpen] = useState(false)

	if (!user) return null

	const profile = profileQuery.data
	const goals = profile?.goals ?? null

	return (
		<>
			<ScreenHeader title={t('pages.profile.title')} backTo={ROUTES.chat} />
			<div className="flex flex-col gap-3 px-gutter pt-2.5 pb-5">
				{/* the name and the date come from the session at once; the goal waits for the profile */}
				<ProfileCard
					name={user.name ?? ''}
					subtitle={getGoalSubtitle(
						{ goalType: profile?.profile.goalType ?? null, createdAt: user.createdAt },
						t,
					)}
					onClick={() => {
						setIsAddressOpen(true)
					}}
				/>
				<Surface variant="list" shadow="list" className="flex flex-col gap-3 p-4">
					<div className="flex min-h-6 items-center justify-between">
						<Text variant="eyebrow" tone="muted">
							{t('profile.goals.title')}
						</Text>
						<Button
							variant="text"
							size="sm"
							aria-haspopup="dialog"
							icon={<Icon name="edit" size={16} />}
							onClick={() => {
								setIsGoalsOpen(true)
							}}
							className="-mr-3.5 min-h-6 no-underline"
						>
							{t('profile.goals.edit')}
						</Button>
					</div>
					{profileQuery.isPending && (
						<div role="status" aria-label={t('common.loading')} className="grid grid-cols-2 gap-2">
							{Array.from({ length: 4 }, (_, index) => (
								<Skeleton key={index} shape="block" className="h-17 rounded-tile" />
							))}
						</div>
					)}
					{profileQuery.isError && (
						<InlineError
							message={t('profile.loadError')}
							onRetry={() => void profileQuery.refetch()}
						/>
					)}
					{profile && <GoalsTiles goals={goals} />}
					<Button
						variant="dark"
						isFullWidth
						icon={<Icon name="sparkle" size={ICON_SIZE.control} className="text-primary-soft" />}
						onClick={() => void navigate(ROUTES.profileGoals)}
						className="gap-2"
					>
						{t('profile.goals.recalc')}
					</Button>
				</Surface>
				<RowGroup>
					<ListRow
						size="lg"
						leading={<ListRowIcon icon="body" tone="protein" />}
						label={t('profile.menu.data')}
						value={t('profile.menu.dataHint')}
						to={ROUTES.profileData}
					/>
					<ListRow
						size="lg"
						leading={<ListRowIcon icon="settings" tone="fat" />}
						label={t('profile.menu.settings')}
						value={t('profile.menu.settingsHint')}
						to={ROUTES.settings}
					/>
				</RowGroup>
				<LogoutButton label={t('profile.logout')} tone="danger" />
			</div>
			<EditAddressSheet
				isOpen={isAddressOpen}
				onOpenChange={setIsAddressOpen}
				addressAs={user.addressAs}
			/>
			<EditGoalsSheet
				isOpen={isGoalsOpen}
				onOpenChange={setIsGoalsOpen}
				goal={toGoalValues(goals)}
			/>
		</>
	)
}
