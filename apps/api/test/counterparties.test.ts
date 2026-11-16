import { expect, test } from 'bun:test';
import { collectCounterparties, counterpartyIdentity, counterpartyIssues, emptyCounterparty, fillEmptyCounterpartyFields, counterpartyConflicts, parseCounterparty } from '../src/modules/technical-tasks/tz-xml/counterparties';
import { buildTzXml, emptyOrganization, emptyRepresentative, getDocumentAuthors, mergeCounterpartySignatories, type CounterpartySignatory } from '../src/modules/technical-tasks/tz-xml';
import { CounterpartiesService } from '../src/modules/counterparties/counterparties.service';
import { buildSampleModel, SAMPLE_IMAGE_URL, SAMPLE_IMAGE_BASE64 } from './fixtures/tz-xml-sample-model';

function org() {
  return { kind: 'ORGANIZATION' as const, details: buildSampleModel().developer.organization };
}

test('юрлицо определяется по ИНН и КПП, переименование не создаёт дубль', () => {
  const a = org();
  expect(counterpartyIdentity(a)).toBe(counterpartyIdentity({ ...a, details: { ...a.details, fullName: 'Другое написание названия' } }));
  expect(counterpartyIdentity(a)).not.toBe(counterpartyIdentity({ ...a, details: { ...a.details, kpp: '773001002' } }));
  expect(counterpartyIdentity({ ...a, details: { ...a.details, inn: '773' } })).toBeNull();
  expect(counterpartyIdentity({ ...a, details: { ...a.details, kpp: '' } })).toBeNull();
});

test('ИП определяется по ОГРНИП независимо от адреса и e-mail', () => {
  const a = parseCounterparty('ENTREPRENEUR', { surname: 'Иванов', name: 'Иван', ogrnip: '123456789012345' });
  expect(counterpartyIssues(a)).toEqual([]);
  expect(counterpartyIdentity(a)).toBe(counterpartyIdentity(parseCounterparty('ENTREPRENEUR', { ...a.details, email: 'new@example.ru', postAddress: { note: 'Другой адрес' } })));
});

test('однофамильцы с разными адресами различаются, регистр и лишние пробелы не создают дубли', () => {
  const a = parseCounterparty('PERSON', { surname: 'Иванов', name: 'Иван', postAddress: { regionCode: '77', note: 'Москва, улица Новая, дом 1' } });
  const b = parseCounterparty('PERSON', { surname: ' ИВАНОВ ', name: 'Иван', postAddress: { regionCode: '77', note: 'Москва,  улица Новая, дом 1' } });
  expect(counterpartyIdentity(a)).toBe(counterpartyIdentity(b));
  expect(counterpartyIdentity(a)).not.toBe(counterpartyIdentity(parseCounterparty('PERSON', { ...a.details, postAddress: { regionCode: '77', note: 'Москва, улица Новая, дом 2' } })));
  expect(counterpartyIdentity(emptyCounterparty('PERSON'))).toBeNull();
  // При заполненном структурном адресе note не участвует в XML и не заменяет номер дома.
  expect(counterpartyIdentity(parseCounterparty('PERSON', { ...a.details, postAddress: { regionCode: '77', city: 'Москва', note: 'Дом 1' } }))).toBeNull();
});

test('сохранение в реестр переносит только реквизиты и не меняет исходную карточку', () => {
  const source = { ...org().details, fileUrl: '/internal/file', counterpartyId: 'foreign', address: { ...org().details.address, secret: 'no' } };
  const snapshot = structuredClone(source);
  const parsed = parseCounterparty('ORGANIZATION', source);
  expect(parsed.details).not.toHaveProperty('fileUrl');
  expect(parsed.details).not.toHaveProperty('counterpartyId');
  expect(source).toEqual(snapshot);
  expect(() => parseCounterparty('ORGANIZATION', { fullName: { bad: 'value' } })).toThrow();
  expect(() => parseCounterparty('PERSON', [])).toThrow();
});

test('выбор из реестра сохраняет ручные поля и не связывает ТЗ с карточкой реестра', () => {
  const source = org().details;
  const current = { ...emptyOrganization(), fullName: 'Ручное название' };
  const filled = fillEmptyCounterpartyFields('ORGANIZATION', current, source);
  expect(filled.fullName).toBe('Ручное название');
  expect(filled.inn).toBe(source.inn);
  source.address.city = 'Адрес изменён в реестре';
  expect(filled.address.city).not.toBe(source.address.city);
  expect(counterpartyConflicts('ORGANIZATION', { ...current, inn: '1111111111' }, source)).toBe(true);
});

test('подстановка физлица сохраняет ручной адрес и e-mail', () => {
  const a = parseCounterparty('PERSON', { surname: 'Иванов', name: 'Иван', email: 'manual@example.ru', postAddress: { regionCode: '77', note: 'Ручной адрес' } });
  const b = parseCounterparty('PERSON', { surname: 'Иванов', name: 'Иван', patronymic: 'Иванович', email: 'registry@example.ru', postAddress: { regionCode: '77', city: 'Москва', building: '1' } });
  if (a.kind !== 'PERSON' || b.kind !== 'PERSON') throw new Error('Неверный тип');
  const filled = fillEmptyCounterpartyFields('PERSON', a.details, b.details);
  expect(filled.email).toBe('manual@example.ru');
  expect(filled.postAddress.note).toBe('Ручной адрес');
  expect(filled.postAddress.city).toBeUndefined();
  expect(filled.patronymic).toBe('Иванович');
  expect(counterpartyConflicts('PERSON', a.details, { ...b.details, surname: 'Петров' })).toBe(true);
});

test('сбор реестра исключает дубли и выключенные роли, не меняет модель и XML старого ТЗ', () => {
  const model = buildSampleModel();
  const snapshot = structuredClone(model);
  const options = { images: { [SAMPLE_IMAGE_URL]: SAMPLE_IMAGE_BASE64 } };
  const xml = buildTzXml(model, options);
  expect(collectCounterparties(model)).toHaveLength(2); // застройщик/утверждение — одна организация
  expect(model).toEqual(snapshot);
  expect(buildTzXml(model, options)).toBe(xml);
  model.enabled.researchers = false;
  expect(collectCounterparties(model)).toHaveLength(1);
});

test('сбор охватывает ИП-исполнителя и физлицо-застройщика', () => {
  const model = buildSampleModel();
  model.developer.kind = 'PERSON';
  model.developer.person = { surname: 'Иванов', name: 'Иван', postAddress: { regionCode: '77', oktmoCode: '', oktmoName: '', note: 'Москва, ул. Новая, дом 1' } };
  model.researchers[0].kind = 'ENTREPRENEUR';
  model.researchers[0].entrepreneur = { surname: 'Петров', name: 'Пётр', ogrnip: '123456789012345', postAddress: { regionCode: '', oktmoCode: '', oktmoName: '' } };
  expect(collectCounterparties(model).map((x) => x.kind).sort()).toEqual(['ENTREPRENEUR', 'ORGANIZATION', 'PERSON']);
});

function registryService(role = 'OWNER', companyId = 'company-a') {
  type Row = { id: string; companyId: string; identityKey: string; details: unknown; name: string; kind: string };
  const rows: Row[] = [];
  let listWhere: unknown;
  const service = new CounterpartiesService({
    companyMember: { findFirst: async () => ({ role, companyId }) },
    counterparty: {
      findMany: async ({ where }: { where: unknown }) => { listWhere = where; return []; },
      count: async () => 0,
      createMany: async ({ data, skipDuplicates }: { data: Omit<Row, 'id'>[]; skipDuplicates: boolean }) => {
        expect(skipDuplicates).toBe(true);
        let count = 0;
        for (const item of data) {
          if (!rows.some((r) => r.companyId === item.companyId && r.identityKey === item.identityKey)) {
            rows.push({ ...structuredClone(item), id: String(rows.length + 1) });
            count++;
          }
        }
        return { count };
      },
      findFirst: async ({ where }: { where: { id: string; companyId: string } }) => rows.find((r) => r.id === where.id && r.companyId === where.companyId) ?? null,
      update: async ({ where, data }: { where: { id: string; companyId: string }; data: Partial<Row> }) => {
        const row = rows.find((r) => r.id === where.id && r.companyId === where.companyId)!;
        Object.assign(row, structuredClone(data));
        return row;
      },
      deleteMany: async ({ where }: { where: { id: string; companyId: string } }) => {
        const i = rows.findIndex((r) => r.id === where.id && r.companyId === where.companyId);
        if (i === -1) return { count: 0 };
        rows.splice(i, 1);
        return { count: 1 };
      },
    },
  } as never);
  return { service, rows, where: () => listWhere };
}

test('повторное сохранение ТЗ не создаёт дубли и не перезаписывает существующие карточки', async () => {
  const { service, rows } = registryService();
  const model = buildSampleModel();
  expect(await service.rememberFromModel('company-a', model)).toBe(2);
  const snapshot = structuredClone(rows);
  model.developer.organization.fullName = 'Новое название только в ТЗ';
  model.approver.organization.fullName = 'Новое название только в ТЗ';
  expect(await service.rememberFromModel('company-a', model)).toBe(0);
  expect(rows).toEqual(snapshot);
  expect(await service.rememberFromModel('company-b', model)).toBe(2); // реестры компаний независимы
});

test('список ограничен компанией, изменение и удаление чужой карточки запрещены', async () => {
  const { service, rows, where } = registryService();
  await service.rememberFromModel('company-b', buildSampleModel());
  await service.list('user', { kind: 'ORGANIZATION', search: 'тест' });
  expect(where()).toMatchObject({ companyId: 'company-a', kind: 'ORGANIZATION' });
  await expect(service.update('user', rows[0].id, org() as never)).rejects.toThrow('Контрагент не найден');
  await expect(service.delete('user', rows[0].id)).rejects.toThrow('Контрагент не найден');
  expect(rows).toHaveLength(2);
});

test('работник не может изменить или удалить общую карточку', async () => {
  const { service } = registryService('WORKER');
  await expect(service.update('user', 'id', org() as never)).rejects.toThrow('Изменять реестр');
  await expect(service.delete('user', 'id')).rejects.toThrow('Изменять реестр');
});

test('удаление карточки из реестра не меняет старое ТЗ', async () => {
  const { service, rows } = registryService();
  const model = buildSampleModel();
  const snapshot = structuredClone(model);
  await service.rememberFromModel('company-a', model);
  await service.delete('user', rows[0].id);
  expect(rows).toHaveLength(1);
  expect(model).toEqual(snapshot);
});

const signatory: CounterpartySignatory = { surname: 'Петров', name: 'Пётр', patronymic: 'Петрович', position: 'Главный инженер', email: 'p@example.ru' };

test('карточка хранит подписантов без роли ТЗ; старые карточки остаются допустимыми', () => {
  const legacy = parseCounterparty('ORGANIZATION', org().details);
  const source = { ...org().details, signatories: [{ ...signatory, functionalRole: 'Утверждено', internalId: 'secret' }] };
  const saved = parseCounterparty('ORGANIZATION', source);
  expect(saved.details).toHaveProperty('signatories', [signatory]);
  expect(counterpartyIdentity(saved)).toBe(counterpartyIdentity(legacy));
  expect(counterpartyIssues(saved)).toEqual([]);
  expect(counterpartyIssues(legacy)).toEqual([]);
  expect(legacy.details).not.toHaveProperty('signatories');
  expect(source.signatories[0].functionalRole).toBe('Утверждено');
  expect(() => parseCounterparty('ORGANIZATION', { ...org().details, signatories: {} })).toThrow();
  expect(() => parseCounterparty('ORGANIZATION', { ...org().details, signatories: Array(101).fill(signatory) })).toThrow();
});

test('незаполненный подписант мешает сохранению карточки, но не меняет идентификатор организации', () => {
  const draft = parseCounterparty('ORGANIZATION', { ...org().details, signatories: [{ surname: '', name: '', position: '', email: 'wrong' }] });
  expect(counterpartyIssues(draft).map((i) => i.path)).toEqual(['details.signatories[0].surname', 'details.signatories[0].name', 'details.signatories[0].position', 'details.signatories[0].email']);
  expect(counterpartyIdentity(draft)).toBe(counterpartyIdentity(org()));
});

test('выбор подписантов дополняет пустую строку, сохраняет роль и ручные поля, повторный выбор не создаёт дублей', () => {
  const current = [emptyRepresentative('Утверждено')];
  const source = [{ ...signatory }, { ...signatory, surname: 'Сидоров', name: 'Сидор' }];
  const filled = mergeCounterpartySignatories(current, source);
  expect(filled).toHaveLength(2);
  expect(filled[0]).toEqual({ ...signatory, functionalRole: 'Утверждено' });
  expect(filled[1].functionalRole).toBe('Согласовано');
  filled[0].position = 'Ручная должность';
  filled[0].email = '';
  const again = mergeCounterpartySignatories(filled, [{ ...signatory, surname: ' ПЕТРОВ ' }]);
  expect(again).toHaveLength(2);
  expect(again[0]).toMatchObject({ surname: 'Петров', position: 'Ручная должность', email: signatory.email, functionalRole: 'Утверждено' });
  expect(current).toEqual([emptyRepresentative('Утверждено')]);
  expect(filled[0].email).toBe('');
  source[1].position = 'Изменение реестра';
  expect(filled[1].position).toBe(signatory.position);
});

test('частично введённого человека не подменяем; роль из реестра не переносим', () => {
  const partial = { ...emptyRepresentative('Утверждено'), surname: 'Ручной' };
  const result = mergeCounterpartySignatories([partial], [{ ...signatory, functionalRole: 'Утверждено' } as CounterpartySignatory]);
  expect(result[0]).toEqual(partial);
  expect(result[1].functionalRole).toBe('Согласовано');
  expect(mergeCounterpartySignatories(result, [])).toEqual(result);
  expect(mergeCounterpartySignatories(result, [signatory])).toEqual(result);
});

test('новая карточка из ТЗ объединяет подписантов одной организации, исключает пустые строки и не изменяет XML', () => {
  const model = buildSampleModel();
  const authors = getDocumentAuthors(model);
  model.authors = [...authors, { kind: 'ORGANIZATION', organization: structuredClone(model.approver.organization), representatives: [{ ...signatory, functionalRole: 'Согласовано' }, emptyRepresentative('Согласовано')] }];
  const before = JSON.stringify(model);
  const xmlBefore = buildTzXml(model, { images: { [SAMPLE_IMAGE_URL]: SAMPLE_IMAGE_BASE64 } });
  const records = collectCounterparties(model);
  const record = records.find((r) => r.kind === 'ORGANIZATION' && r.details.inn === model.approver.organization.inn)!;
  if (record.kind !== 'ORGANIZATION') throw new Error('Ожидалась организация');
  expect(record.details.signatories?.map((s) => s.surname)).toEqual(['Иванов', 'Петров']);
  expect(record.details.signatories?.[0]).not.toHaveProperty('functionalRole');
  expect(JSON.stringify(model)).toBe(before);
  expect(buildTzXml(model, { images: { [SAMPLE_IMAGE_URL]: SAMPLE_IMAGE_BASE64 } })).toBe(xmlBefore);
});

test('изменение подписантов ТЗ не обновляет существующую карточку; явное изменение реестра не меняет ТЗ', async () => {
  const { service, rows } = registryService();
  const model = buildSampleModel();
  await service.rememberFromModel('company-a', model);
  const row = rows.find((r) => (r.details as { inn?: string }).inn === model.approver.organization.inn)!;
  const saved = structuredClone(row.details);
  model.approver.representatives.push({ ...signatory, functionalRole: 'Согласовано' });
  await service.rememberFromModel('company-a', model);
  expect(row.details).toEqual(saved);
  const before = JSON.stringify(model);
  await service.update('user', row.id, { ...org(), details: { ...org().details, signatories: [signatory] } } as never);
  expect(row.details).toHaveProperty('signatories', [signatory]);
  expect(row).toHaveProperty('searchText', expect.stringContaining('Петров'));
  expect(JSON.stringify(model)).toBe(before);
});

test('старый клиент при обновлении реквизитов не удаляет подписантов; явный пустой список удаляет', async () => {
  const { service, rows } = registryService();
  await service.rememberFromModel('company-a', buildSampleModel());
  const row = rows.find((r) => (r.details as { inn?: string }).inn === org().details.inn)!;
  const signatories = (row.details as { signatories: unknown }).signatories;
  await service.update('user', row.id, org() as never);
  expect(row.details).toHaveProperty('signatories', signatories);
  await service.update('user', row.id, { ...org(), details: { ...org().details, signatories: [] } } as never);
  expect(row.details).toHaveProperty('signatories', []);
});
