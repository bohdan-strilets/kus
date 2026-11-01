import { programProposalParamsSchema } from '@kus/shared'
import { createZodDto } from 'nestjs-zod'

export class ProgramProposalParamsDto extends createZodDto(programProposalParamsSchema) {}
