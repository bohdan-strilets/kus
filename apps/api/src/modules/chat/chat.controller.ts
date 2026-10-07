import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { ChatMessage, SendMessageResponse } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import type { CursorPaginatedResult } from '../../common/pagination'
import { ChatFeedService } from './chat-feed.service'
import { SEND_MESSAGE_THROTTLE } from './chat.constants'
import { ChatService } from './chat.service'
import { ListMessagesQueryDto, SendMessageDto } from './dto'

@Controller('messages')
export class ChatController {
	constructor(
		private readonly chatService: ChatService,
		private readonly chatFeed: ChatFeedService,
	) {}

	@Throttle(SEND_MESSAGE_THROTTLE)
	@Post()
	sendMessage(
		@CurrentUser() user: AuthenticatedUser,
		@Body() body: SendMessageDto,
	): Promise<SendMessageResponse> {
		return this.chatService.sendMessage(user.sub, body)
	}

	@Get()
	listMessages(
		@CurrentUser() user: AuthenticatedUser,
		@Query() query: ListMessagesQueryDto,
	): Promise<CursorPaginatedResult<ChatMessage>> {
		return this.chatFeed.listMessages(user.sub, query)
	}
}
