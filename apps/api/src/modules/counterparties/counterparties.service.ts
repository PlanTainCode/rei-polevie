import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { collectCounterparties, counterpartyIdentity, counterpartyIssues, counterpartyName, parseCounterparty } from '../technical-tasks/tz-xml/counterparties';
import type { CounterpartyDraft } from '../technical-tasks/tz-xml/counterparties';
import type { TzXmlModel } from '../technical-tasks/tz-xml/model';
import { ListCounterpartiesDto, SaveCounterpartyDto } from './counterparty.dto';

@Injectable()
export class CounterpartiesService {
  constructor(private prisma: PrismaService) {}

  private async membership(userId: string, manage = false) {
    const member = await this.prisma.companyMember.findFirst({ where: { userId } });
    if (!member) throw new ForbiddenException('Вы не состоите в компании');
    if (manage && !['OWNER', 'ADMIN', 'MANAGER'].includes(member.role)) {
      throw new ForbiddenException('Изменять реестр может руководитель, администратор или менеджер');
    }
    return member;
  }

  private prepare(dto: SaveCounterpartyDto) {
    let draft: CounterpartyDraft;
    try {
      draft = parseCounterparty(dto.kind, dto.details);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'Некорректные реквизиты');
    }
    const issues = counterpartyIssues(draft);
    if (issues.length) throw new BadRequestException({ message: 'Заполните данные для сохранения в реестре', issues });
    return this.recordData(draft);
  }

  private recordData(draft: CounterpartyDraft) {
    const d = draft.details;
    const identifiers = draft.kind === 'ORGANIZATION'
      ? [draft.details.inn, draft.details.kpp, draft.details.ogrn, draft.details.rafp, draft.details.abbreviatedName]
      : draft.kind === 'ENTREPRENEUR' ? [draft.details.inn, draft.details.ogrnip] : [];
    const name = counterpartyName(draft);
    return {
      kind: draft.kind,
      identityKey: createHash('sha256').update(counterpartyIdentity(draft)!).digest('hex'),
      name,
      searchText: [name, ...identifiers].filter(Boolean).join(' '),
      details: d as unknown as Prisma.InputJsonValue,
    };
  }

  async list(userId: string, query: ListCounterpartiesDto) {
    const member = await this.membership(userId);
    const where: Prisma.CounterpartyWhereInput = {
      companyId: member.companyId,
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.search?.trim() ? { searchText: { contains: query.search.trim(), mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.counterparty.findMany({ where, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 100 }),
      this.prisma.counterparty.count({ where }),
    ]);
    return { items, total, canManage: ['OWNER', 'ADMIN', 'MANAGER'].includes(member.role) };
  }

  async create(userId: string, dto: SaveCounterpartyDto) {
    const member = await this.membership(userId);
    const data = this.prepare(dto);
    try {
      return await this.prisma.counterparty.create({ data: { ...data, companyId: member.companyId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Контрагент с такими идентификационными данными уже есть в реестре');
      }
      throw error;
    }
  }

  async update(userId: string, id: string, dto: SaveCounterpartyDto) {
    const member = await this.membership(userId, true);
    const existing = await this.prisma.counterparty.findFirst({ where: { id, companyId: member.companyId } });
    if (!existing) throw new NotFoundException('Контрагент не найден');
    const data = this.prepare(dto);
    try {
      return await this.prisma.counterparty.update({ where: { id, companyId: member.companyId }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Контрагент с такими идентификационными данными уже есть в реестре');
      }
      throw error;
    }
  }

  async delete(userId: string, id: string) {
    const member = await this.membership(userId, true);
    const result = await this.prisma.counterparty.deleteMany({ where: { id, companyId: member.companyId } });
    if (!result.count) throw new NotFoundException('Контрагент не найден');
    return { success: true };
  }

  /** Вызывается после проверки доступа к ТЗ, с companyId самого задания. */
  async rememberFromModel(companyId: string, model: TzXmlModel): Promise<number> {
    const candidates = collectCounterparties(model);
    if (!candidates.length) return 0;
    const result = await this.prisma.counterparty.createMany({
      data: candidates.map((draft) => ({ ...this.recordData(draft), companyId })),
      // Повторное сохранение и параллельные запросы не создают дубли и не обновляют карточки.
      skipDuplicates: true,
    });
    return result.count;
  }
}
