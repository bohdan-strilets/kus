import { Controller, Param, Post } from '@nestjs/common'
import type { ProgramResponse, RebaseProgramProposalResponse } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { ChatProgramProposalsService } from './chat-program-proposals.service'
import { ProgramProposalParamsDto } from './dto'

/** A program card of the chat; here and not in programs, since a card is a chat message. */
@Controller('programs/proposals')
export class ProgramProposalsController {
	constructor(private readonly proposals: ChatProgramProposalsService) {}

	@Post(':messageId/accept')
	accept(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { messageId }: ProgramProposalParamsDto,
	): Promise<ProgramResponse> {
		return this.proposals.accept(user.sub, messageId)
	}

	@Post(':messageId/rebase')
	rebase(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { messageId }: ProgramProposalParamsDto,
	): Promise<RebaseProgramProposalResponse> {
		return this.proposals.rebase(user.sub, messageId)
	}
}
