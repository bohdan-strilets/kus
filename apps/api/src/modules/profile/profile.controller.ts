import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Put } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { GoalsPreviewResponse, ProfileGoals, ProfileResponse } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { SaveGoalsDto, UpdateProfileDto } from './dto'
import {
	PREVIEW_GOALS_THROTTLE,
	SAVE_GOALS_THROTTLE,
	UPDATE_PROFILE_THROTTLE,
} from './profile.constants'
import { ProfileService } from './profile.service'

/** Always the caller's own profile: there is no `/profile/:id`. */
@Controller('profile')
export class ProfileController {
	constructor(private readonly profileService: ProfileService) {}

	@Get()
	getProfile(@CurrentUser() user: AuthenticatedUser): Promise<ProfileResponse> {
		return this.profileService.getProfile(user.sub)
	}

	@Throttle(UPDATE_PROFILE_THROTTLE)
	@Patch()
	updateProfile(
		@CurrentUser() user: AuthenticatedUser,
		@Body() body: UpdateProfileDto,
	): Promise<ProfileResponse> {
		return this.profileService.updateProfile(user.sub, body)
	}

	/** POST, not GET: it computes rather than reads, and the client never caches it. */
	@Throttle(PREVIEW_GOALS_THROTTLE)
	@Post('goals/preview')
	@HttpCode(HttpStatus.OK)
	previewGoals(@CurrentUser() user: AuthenticatedUser): Promise<GoalsPreviewResponse> {
		return this.profileService.previewGoals(user.sub)
	}

	@Throttle(SAVE_GOALS_THROTTLE)
	@Put('goals')
	saveGoals(
		@CurrentUser() user: AuthenticatedUser,
		@Body() body: SaveGoalsDto,
	): Promise<ProfileGoals> {
		return this.profileService.saveGoals(user.sub, body)
	}
}
