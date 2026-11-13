import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CounterpartiesService } from './counterparties.service';
import { ListCounterpartiesDto, SaveCounterpartyDto } from './counterparty.dto';

type Req = { user: { userId: string } };

@Controller('counterparties')
@UseGuards(JwtAuthGuard)
export class CounterpartiesController {
  constructor(private service: CounterpartiesService) {}

  @Get()
  list(@Request() req: Req, @Query() query: ListCounterpartiesDto) {
    return this.service.list(req.user.userId, query);
  }

  @Post()
  create(@Request() req: Req, @Body() dto: SaveCounterpartyDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(@Request() req: Req, @Param('id') id: string, @Body() dto: SaveCounterpartyDto) {
    return this.service.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  delete(@Request() req: Req, @Param('id') id: string) {
    return this.service.delete(req.user.userId, id);
  }
}
