import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
} from '@nestjs/common'
import type { ProgramResponse, ProgramVersionListResponse } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import {
	ProgramTemplateParamsDto,
	SaveTemplateDto,
	UpdateProgramSettingsDto,
	UpdateTemplateScheduleDto,
} from './dto'
import { ProgramsService } from './programs.service'

/** The training program: one active per user; «active» is the only id the routes know. */
@Controller('programs')
export class ProgramsController {
	constructor(private readonly programsService: ProgramsService) {}

	@Get('active')
	getActive(@CurrentUser() user: AuthenticatedUser): Promise<ProgramResponse | null> {
		return this.programsService.getActive(user.sub)
	}

	@Get('active/versions')
	listVersions(@CurrentUser() user: AuthenticatedUser): Promise<ProgramVersionListResponse> {
		return this.programsService.listVersions(user.sub)
	}

	@Patch('active')
	updateSettings(
		@CurrentUser() user: AuthenticatedUser,
		@Body() body: UpdateProgramSettingsDto,
	): Promise<ProgramResponse> {
		return this.programsService.updateSettings(user.sub, body)
	}

	@Patch('active/templates/:templateId')
	updateTemplateWeekdays(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { templateId }: ProgramTemplateParamsDto,
		@Body() { weekdays }: UpdateTemplateScheduleDto,
	): Promise<ProgramResponse> {
		return this.programsService.updateTemplateWeekdays(user.sub, templateId, weekdays)
	}

	@Post('active/versions')
	saveTemplate(
		@CurrentUser() user: AuthenticatedUser,
		@Body() body: SaveTemplateDto,
	): Promise<ProgramResponse> {
		return this.programsService.saveTemplate(user.sub, body)
	}

	@Delete('active')
	@HttpCode(HttpStatus.NO_CONTENT)
	remove(@CurrentUser() user: AuthenticatedUser): Promise<void> {
		return this.programsService.remove(user.sub)
	}
}
