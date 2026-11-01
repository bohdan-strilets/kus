import type { ProgramResponse } from '@kus/shared'
import { useTranslation } from 'react-i18next'

import {
	formatProgramCreated,
	formatProgramVersionWhen,
	getProgramChangeGroups,
	ProgramChangeList,
	useProgramVersions,
} from '@/entities/program'
import { BaseBottomSheet, InlineError, Skeleton, Text } from '@/shared/ui'

interface ProgramVersionsSheetProps {
	isOpen: boolean
	onOpenChange: (isOpen: boolean) => void
	program: ProgramResponse
}

const SKELETON_ROWS = 3

/** «Що змінилось» (mockups/training-program.html): the versions newest first, each with its lines. */
export const ProgramVersionsSheet = ({
	isOpen,
	onOpenChange,
	program,
}: ProgramVersionsSheetProps) => {
	const { t } = useTranslation()
	const versions = useProgramVersions({ enabled: isOpen })
	const items = versions.data

	return (
		<BaseBottomSheet
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			title={t('program.versions.title')}
			description={t('program.versions.description')}
		>
			<div className="flex flex-col gap-3">
				{items?.map((version) => (
					<section
						key={version.id}
						className="flex flex-col gap-1.5 border-t border-divider pt-3 first:border-t-0 first:pt-0"
					>
						<Text as="p" role="heading" aria-level={3} variant="caption" weight="bold">
							{formatProgramVersionWhen(version, t)}
						</Text>
						{version.changes.initial ? (
							<Text variant="caption" tone="mutedStrong" weight="regular">
								{formatProgramCreated(items.length === 1 ? program : null, t)}
							</Text>
						) : (
							<ProgramChangeList
								groups={getProgramChangeGroups(version.changes, program, t)}
								isPrefixed
							/>
						)}
					</section>
				))}
				{!items && versions.isError && (
					<InlineError
						message={t('program.versions.loadError')}
						onRetry={() => void versions.refetch()}
					/>
				)}
				{versions.isPending && (
					<div role="status" aria-label={t('common.loading')} className="flex flex-col gap-2">
						{Array.from({ length: SKELETON_ROWS }, (_, index) => (
							<Skeleton key={index} shape="block" className="h-9 w-full" />
						))}
					</div>
				)}
				<Text variant="small" tone="muted" weight="regular">
					{t('program.versions.note')}
				</Text>
			</div>
		</BaseBottomSheet>
	)
}
