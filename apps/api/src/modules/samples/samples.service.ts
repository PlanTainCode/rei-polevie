import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SamplesService {
  constructor(private prisma: PrismaService) {}

  // TODO: Реализовать методы для работы с пробами
  // - findByOrderId: получение проб по ID приказа
  // - updateSample: обновление данных пробы (характеристика, координаты)
  // - updateStatus: обновление статуса пробы
  // - parseGpsPhoto: распознавание координат с фото GPS трекера
  // - generateLabels: генерация бирок для проб
  // - generateSubcontractDocs: генерация документов для подряда
}

