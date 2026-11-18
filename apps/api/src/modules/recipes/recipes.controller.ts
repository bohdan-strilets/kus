import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
} from '@nestjs/common'
import type { LogRecipePortionResponse, RecipeDetail, RecipeListItem } from '@kus/shared'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import type { PaginatedResult } from '../../common/pagination'
import { LogRecipePortionDto, RecipeParamsDto, RecipesQueryDto } from './dto'
import { RecipesService } from './recipes.service'

/** «Рецепти»: saved dishes and «Додати на сьогодні». */
@Controller('recipes')
export class RecipesController {
	constructor(private readonly recipesService: RecipesService) {}

	@Get()
	list(
		@CurrentUser() user: AuthenticatedUser,
		@Query() query: RecipesQueryDto,
	): Promise<PaginatedResult<RecipeListItem>> {
		return this.recipesService.list(user.sub, query)
	}

	@Get(':id')
	get(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: RecipeParamsDto,
	): Promise<RecipeDetail> {
		return this.recipesService.get(user.sub, id)
	}

	@Post(':id/log')
	@HttpCode(HttpStatus.OK)
	log(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: RecipeParamsDto,
		@Body() { share }: LogRecipePortionDto,
	): Promise<LogRecipePortionResponse> {
		return this.recipesService.logPortion(user.sub, id, share)
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	remove(@CurrentUser() user: AuthenticatedUser, @Param() { id }: RecipeParamsDto): Promise<void> {
		return this.recipesService.remove(user.sub, id)
	}

	@Post(':id/restore')
	@HttpCode(HttpStatus.OK)
	restore(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: RecipeParamsDto,
	): Promise<RecipeListItem> {
		return this.recipesService.restore(user.sub, id)
	}
}
