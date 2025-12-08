import { Controller, UseGuards } from '@nestjs/common';
import { SamplesService } from './samples.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('samples')
@UseGuards(JwtAuthGuard)
export class SamplesController {
  constructor(private samplesService: SamplesService) {}

  // TODO: Реализовать эндпоинты
  // GET /order/:orderId - список проб приказа
  // GET /:id - получение пробы
  // PATCH /:id - обновление пробы
  // POST /:id/gps-photo - загрузка фото GPS трекера
  // GET /order/:orderId/labels - генерация бирок
  // GET /order/:orderId/subcontract - документы для подряда
}

