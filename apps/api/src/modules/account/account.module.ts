import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { ChatModule } from '../chat/chat.module'
import { UsersModule } from '../users/users.module'
import { AccountPurgeService } from './account-purge.service'
import { AccountController } from './account.controller'
import { AccountRepository } from './account.repository'
import { AccountService } from './account.service'
import { PendingDeletionGuard } from './guards/pending-deletion.guard'

@Module({
	imports: [AuthModule, ChatModule, UsersModule],
	controllers: [AccountController],
	providers: [AccountService, AccountRepository, AccountPurgeService, PendingDeletionGuard],
	// the guard is registered globally in AppModule, which resolves it from here
	exports: [PendingDeletionGuard],
})
export class AccountModule {}
