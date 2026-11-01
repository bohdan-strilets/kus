import {
	programTemplateParamsSchema,
	saveTemplateRequestSchema,
	updateProgramSettingsRequestSchema,
	updateTemplateScheduleRequestSchema,
} from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class UpdateProgramSettingsDto extends createZodDto(updateProgramSettingsRequestSchema) {}

export class ProgramTemplateParamsDto extends createZodDto(programTemplateParamsSchema) {}

export class UpdateTemplateScheduleDto extends createZodDto(updateTemplateScheduleRequestSchema) {}

export class SaveTemplateDto extends createZodDto(saveTemplateRequestSchema) {}
