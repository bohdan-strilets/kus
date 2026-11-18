import { Module } from '@nestjs/common'

import { EntriesModule } from '../entries/entries.module'
import { UsersModule } from '../users/users.module'
import { RecipesController } from './recipes.controller'
import { RecipesRepository } from './recipes.repository'
import { RecipesService } from './recipes.service'

@Module({
	imports: [EntriesModule, UsersModule],
	controllers: [RecipesController],
	providers: [RecipesService, RecipesRepository],
	exports: [RecipesService],
})
export class RecipesModule {}
