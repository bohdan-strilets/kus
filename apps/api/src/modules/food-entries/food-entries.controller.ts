import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common'
import type { FoodEntryResponse } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { FoodEntryParamsDto, UpdateFoodEntryDto } from './dto'
import { FoodEntriesService } from './food-entries.service'

/** The edit sheet on «Сьогодні» and under a chat card: one logged entry at a time, no model. */
@Controller('food-entries')
export class FoodEntriesController {
	constructor(private readonly foodEntriesService: FoodEntriesService) {}

	@Patch(':id')
	update(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: FoodEntryParamsDto,
		@Body() body: UpdateFoodEntryDto,
	): Promise<FoodEntryResponse> {
		return this.foodEntriesService.update(user.sub, id, body)
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	remove(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: FoodEntryParamsDto,
	): Promise<void> {
		return this.foodEntriesService.remove(user.sub, id)
	}
}
