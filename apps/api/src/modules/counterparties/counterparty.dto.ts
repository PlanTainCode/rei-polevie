import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { COUNTERPARTY_KINDS, type CounterpartyKind } from '../technical-tasks/tz-xml/counterparties';

export class SaveCounterpartyDto {
  @IsIn(COUNTERPARTY_KINDS)
  kind: CounterpartyKind;

  @IsObject()
  details: Record<string, unknown>;
}

export class ListCounterpartiesDto {
  @IsOptional()
  @IsIn(COUNTERPARTY_KINDS)
  kind?: CounterpartyKind;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
