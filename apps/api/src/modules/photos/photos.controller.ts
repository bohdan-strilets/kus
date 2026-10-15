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
	Res,
	StreamableFile,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { UploadPhotoResponse } from '@kus/shared'
import type { Response } from 'express'

import { type AuthenticatedUser, CurrentUser } from '../../common/decorators'
import { PhotoParamsDto, PhotoQueryDto, UploadPhotoDto } from './dto'
import { PHOTO_CACHE_CONTROL, PHOTO_READ_THROTTLE, PHOTO_UPLOAD_THROTTLE } from './photos.constants'
import { PhotosService } from './photos.service'

/** Photos are uploaded ahead of the message that uses them (POST /messages takes their ids). */
@Controller('photos')
export class PhotosController {
	constructor(private readonly photosService: PhotosService) {}

	@Throttle(PHOTO_UPLOAD_THROTTLE)
	@Post()
	upload(
		@CurrentUser() user: AuthenticatedUser,
		@Body() body: UploadPhotoDto,
	): Promise<UploadPhotoResponse> {
		return this.photosService.upload(user.sub, body)
	}

	/** Raw bytes, not `{ data }`. The cache headers are set after the lookup so a 404 never gets them. */
	@Throttle(PHOTO_READ_THROTTLE)
	@Get(':id')
	async getFile(
		@CurrentUser() user: AuthenticatedUser,
		@Param() { id }: PhotoParamsDto,
		@Query() { variant }: PhotoQueryDto,
		@Res({ passthrough: true }) res: Response,
	): Promise<StreamableFile> {
		const file = await this.photosService.getFile(user.sub, id, variant)
		res.set({
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': PHOTO_CACHE_CONTROL,
		})
		return new StreamableFile(file.body, { type: file.contentType, length: file.body.length })
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	remove(@CurrentUser() user: AuthenticatedUser, @Param() { id }: PhotoParamsDto): Promise<void> {
		return this.photosService.remove(user.sub, id)
	}
}
