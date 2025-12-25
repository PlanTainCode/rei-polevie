import { Module } from '@nestjs/common';
import { InquiryRequestsController } from './inquiry-requests.controller';
import { InquiryRequestsService } from './inquiry-requests.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [InquiryRequestsController],
  providers: [InquiryRequestsService],
  exports: [InquiryRequestsService],
})
export class InquiryRequestsModule {}

