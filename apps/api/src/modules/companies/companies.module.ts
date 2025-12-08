import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';

@Module({
  controllers: [CompaniesController, InvitationsController],
  providers: [CompaniesService, InvitationsService],
  exports: [CompaniesService, InvitationsService],
})
export class CompaniesModule {}

