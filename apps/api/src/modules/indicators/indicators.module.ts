import { Module } from '@nestjs/common';
import { IndicatorsController } from './indicators.controller';
import { IndicatorsService } from './indicators.service';
import { ProtocolParserService } from './protocol-parser.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IndicatorsController],
  providers: [IndicatorsService, ProtocolParserService],
  exports: [IndicatorsService],
})
export class IndicatorsModule {}
