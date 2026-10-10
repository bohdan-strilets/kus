import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { getProfileRows, type ProfileFieldKey, profileQueryOptions } from '@/entities/profile'
import { EditProfileFieldSheet } from '@/features/edit-profile-field'
import { ROUTES } from '@/shared/config'
import {
	Button,
	InlineError,
	ListRow,
	RowGroup,
	ScreenHeader,
	Skeleton,
	Surface,
	Text,
} from '@/shared/ui'

import { MyDataSection } from './MyDataSection'

/** mockups/my-data.html: what Kusik knows about the body and the goal; a tap opens the edit sheet. */
export const MyDataPage = () => {
	const { t } = useTranslation()
	const navigate = useNavigate()
	const query = useQuery(profileQueryOptions)
	const [field, setField] = useState<ProfileFieldKey | null>(null)

	const renderContent = () => {
		if (query.isPending) {
			return (
				<div role="status" aria-label={t('common.loading')} className="flex flex-col gap-3">
					<Skeleton shape="block" className="h-72 rounded-card" />
					<Skeleton shape="block" className="h-40 rounded-card" />
					<Skeleton shape="block" className="h-32 rounded-card" />
				</div>
			)
		}
		// a failed refetch keeps the rows already shown; the error is only for an empty screen
		const profile = query.data
		if (!profile) {
			return <InlineError message={t('profile.loadError')} onRetry={() => void query.refetch()} />
		}

		const rows = getProfileRows(profile, t)
		const sections = [
			{ title: t('profile.data.sections.body'), rows: rows.body },
			{ title: t('profile.data.sections.goal'), rows: rows.goal },
		]

		return (
			<>
				{sections.map((section) => (
					<MyDataSection key={section.title} title={section.title}>
						<RowGroup>
							{section.rows.map((row) => (
								<ListRow
									key={row.key}
									label={row.label}
									value={row.value ?? t('profile.data.notSet')}
									onClick={() => {
										setField(row.key)
									}}
									hasPopup
								/>
							))}
						</RowGroup>
					</MyDataSection>
				))}
				<Surface variant="list" shadow="list" className="flex flex-col gap-2.5 p-3.5">
					<Text variant="cardTitle" weight="regular" tone="mutedStrong">
						{t('profile.data.recalcText')}
					</Text>
					<Button
						variant="dark"
						isFullWidth
						onClick={() => {
							void navigate(ROUTES.profileGoals)
						}}
					>
						{t('profile.goals.recalc')}
					</Button>
				</Surface>
				<EditProfileFieldSheet
					field={field}
					profile={query.data}
					onClose={() => {
						setField(null)
					}}
				/>
			</>
		)
	}

	return (
		<>
			<ScreenHeader
				title={t('profile.data.title')}
				subtitle={t('profile.data.subtitle')}
				backTo={ROUTES.profile}
			/>
			<div className="flex flex-col gap-3 px-gutter pt-2.5 pb-5">{renderContent()}</div>
		</>
	)
}
