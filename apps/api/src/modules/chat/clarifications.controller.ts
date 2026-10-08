import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common'
import type { ChatMessage } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { ClarificationsService } from './clarifications.service'
import { AnswerClarificationDto, ClarificationParamsDto } from './dto'

@Controller('clarifications')
export class ClarificationsController {
	constructor(private readonly clarificationsService: ClarificationsService) {}

	@Post(':id/answer')
	@HttpCode(HttpStatus.OK)
	answer(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: ClarificationParamsDto,
		@Body() { optionIndex }: AnswerClarificationDto,
	): Promise<ChatMessage> {
		return this.clarificationsService.answer(user.sub, { id, optionIndex })
	}
}
