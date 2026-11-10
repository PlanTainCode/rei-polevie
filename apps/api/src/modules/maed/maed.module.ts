import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MaedController } from './maed.controller';
import { MaedService } from './maed.service';

@Module({ imports: [PrismaModule], controllers: [MaedController], providers: [MaedService] })
export class MaedModule {}
