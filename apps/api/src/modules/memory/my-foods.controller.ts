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
	Query,
} from '@nestjs/common'
import type { MyFoodResponse, RememberEntriesResponse } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import type { PaginatedResult } from '../../common/pagination'
import { MyFoodParamsDto, MyFoodsQueryDto, RememberEntriesDto, UpdateMyFoodDto } from './dto'
import { MyFoodsService } from './my-foods.service'

/** «Пам'ять · Продукти» and the «Запам'ятати» button. */
@Controller('my-foods')
export class MyFoodsController {
	constructor(private readonly myFoodsService: MyFoodsService) {}

	@Get()
	list(
		@CurrentUser() user: AuthenticatedUser,
		@Query() query: MyFoodsQueryDto,
	): Promise<PaginatedResult<MyFoodResponse>> {
		return this.myFoodsService.list(user.sub, query)
	}

	// before the `:id` routes, so "from-entries" is never read as an id
	@Post('from-entries')
	rememberEntries(
		@CurrentUser() user: AuthenticatedUser,
		@Body() { entryIds }: RememberEntriesDto,
	): Promise<RememberEntriesResponse> {
		return this.myFoodsService.rememberEntries(user.sub, entryIds)
	}

	@Patch(':id')
	update(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: MyFoodParamsDto,
		@Body() body: UpdateMyFoodDto,
	): Promise<MyFoodResponse> {
		return this.myFoodsService.update(user.sub, id, body)
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	remove(@CurrentUser() user: AuthenticatedUser, @Param() { id }: MyFoodParamsDto): Promise<void> {
		return this.myFoodsService.remove(user.sub, id)
	}

	@Post(':id/restore')
	@HttpCode(HttpStatus.OK)
	restore(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: MyFoodParamsDto,
	): Promise<MyFoodResponse> {
		return this.myFoodsService.restore(user.sub, id)
	}
}
