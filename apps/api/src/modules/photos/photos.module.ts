import { Module } from '@nestjs/common'

import { AiModule } from '../ai/ai.module'
import { UsersModule } from '../users/users.module'
import { PhotosController } from './photos.controller'
import { PhotosRepository } from './photos.repository'
import { PhotosService } from './photos.service'

@Module({
	imports: [AiModule, UsersModule],
	controllers: [PhotosController],
	providers: [PhotosService, PhotosRepository],
	exports: [PhotosService],
})
export class PhotosModule {}
