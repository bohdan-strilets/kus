import { Controller, Get, Query } from '@nestjs/common'
import type { ProgressResponse } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { ProgressQueryDto } from './dto'
import { ProgressService } from './progress.service'

@Controller('progress')
export class ProgressController {
	constructor(private readonly progressService: ProgressService) {}

	@Get()
	getProgress(
		@CurrentUser() user: AuthenticatedUser,
		@Query() { range }: ProgressQueryDto,
	): Promise<ProgressResponse> {
		return this.progressService.getProgress(user.sub, range)
	}
}
