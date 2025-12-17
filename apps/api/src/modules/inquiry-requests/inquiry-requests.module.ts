import { Module } from '@nestjs/common';
import { InquiryRequestsController } from './inquiry-requests.controller';
import { InquiryRequestsService } from './inquiry-requests.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InquiryRequestsController],
  providers: [InquiryRequestsService],
  exports: [InquiryRequestsService],
})
export class InquiryRequestsModule {}

