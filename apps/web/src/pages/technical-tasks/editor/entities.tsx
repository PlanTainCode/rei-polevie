/**
 * Редакторы сущностей схемы: адрес, организация, физлицо, ИП, подписант,
 * контролёр. Используются во многих блоках конструктора.
 */

import { REGION_CODES, type ControlPerson, type Entrepreneur, type Organization, type Person, type Representative, type RussianAddress, type ValidationIssue } from '@tz-xml';
import { Grid, SelectField, TextField, errorFor, type Provenance } from './fields';

interface AddressEditorProps {
  value: RussianAddress;
  onChange: (v: RussianAddress) => void;
  issues: ValidationIssue[];
  path: string;
  postal?: boolean;
  provenance?: Provenance;
}

export function AddressEditor({ value, onChange, issues, path, postal = false, provenance }: AddressEditorProps) {
  const set = <K extends keyof RussianAddress>(k: K, v: RussianAddress[K]) => onChange({ ...value, [k]: v === '' ? undefined : v });
  return (
    <div className="space-y-3">
      <Grid cols={3}>
        <SelectField label="Субъект РФ" value={value.regionCode} onChange={(v) => onChange({ ...value, regionCode: v })} options={REGION_CODES} required error={errorFor(issues, `${path}.regionCode`)} provenance={provenance} />
        <TextField label="Почтовый индекс" value={value.postIndex} onChange={(v) => set('postIndex', v)} required={postal} placeholder="121059" error={errorFor(issues, `${path}.postIndex`)} />
        <TextField label="Код ОКТМО" value={value.oktmoCode} onChange={(v) => onChange({ ...value, oktmoCode: v })} required placeholder="45318000" hint="8 или 11 цифр" error={errorFor(issues, `${path}.oktmoCode`)} />
      </Grid>
      <TextField label="Наименование муниципального образования (ОКТМО)" value={value.oktmoName} onChange={(v) => onChange({ ...value, oktmoName: v })} required placeholder="Муниципальный округ Дорогомилово" error={errorFor(issues, `${path}.oktmoName`)} />
      <Grid cols={3}>
        <TextField label="Район" value={value.district} onChange={(v) => set('district', v)} />
        <TextField label="Город" value={value.city} onChange={(v) => set('city', v)} placeholder="Москва" />
        <TextField label="Населённый пункт" value={value.settlement} onChange={(v) => set('settlement', v)} />
      </Grid>
      <Grid cols={3}>
        <TextField label="Улица" value={value.street} onChange={(v) => set('street', v)} />
        <TextField label="Дом / сооружение" value={value.building} onChange={(v) => set('building', v)} />
        <TextField label="Помещение" value={value.room} onChange={(v) => set('room', v)} />
      </Grid>
      <TextField
        label="Неформализованное описание адреса"
        value={value.note}
        onChange={(v) => set('note', v)}
        hint="используется, если адрес не разбивается по полям выше"
        error={errorFor(issues, `${path}.note`)}
      />
    </div>
  );
}

interface OrganizationEditorProps {
  value: Organization;
  onChange: (v: Organization) => void;
  issues: ValidationIssue[];
  path: string;
  nopriz?: boolean;
  provenance?: Provenance;
}

export function OrganizationEditor({ value, onChange, issues, path, nopriz = false, provenance }: OrganizationEditorProps) {
  const set = <K extends keyof Organization>(k: K, v: Organization[K]) => onChange({ ...value, [k]: v === '' ? undefined : v });
  return (
    <div className="space-y-3">
      <TextField label="Полное наименование" value={value.fullName} onChange={(v) => onChange({ ...value, fullName: v })} required provenance={provenance} error={errorFor(issues, `${path}.fullName`)} />
      <Grid cols={4}>
        <TextField label="Сокращённое наименование" value={value.abbreviatedName} onChange={(v) => set('abbreviatedName', v)} />
        <TextField label="ИНН" value={value.inn} onChange={(v) => onChange({ ...value, inn: v })} required hint="10 цифр" error={errorFor(issues, `${path}.inn`)} />
        <TextField label="КПП" value={value.kpp} onChange={(v) => onChange({ ...value, kpp: v })} required hint="9 цифр" error={errorFor(issues, `${path}.kpp`)} />
        <TextField label="ОГРН" value={value.ogrn} onChange={(v) => set('ogrn', v)} required hint="13 цифр" error={errorFor(issues, `${path}.ogrn`) ?? errorFor(issues, `${path}.rafp`)} />
      </Grid>
      <Grid cols={2}>
        <TextField label="E-mail" value={value.email} onChange={(v) => set('email', v)} type="email" error={errorFor(issues, `${path}.email`)} />
        {nopriz && (
          <TextField
            label="Реестровый номер НОПРИЗ"
            value={value.noprizNumber}
            onChange={(v) => set('noprizNumber', v)}
            required
            placeholder="И-001-000000000001-2020 или «Не требуется»"
            error={errorFor(issues, `${path}.noprizNumber`)}
          />
        )}
      </Grid>
      <div className="pt-1">
        <div className="text-sm font-medium text-[var(--text-secondary)] mb-2">Адрес (местонахождение)</div>
        <AddressEditor value={value.address} onChange={(address) => onChange({ ...value, address })} issues={issues} path={`${path}.address`} />
      </div>
    </div>
  );
}

function FioFields<T extends { surname: string; name: string; patronymic?: string }>({ value, onChange, issues, path }: { value: T; onChange: (v: T) => void; issues: ValidationIssue[]; path: string }) {
  return (
    <Grid cols={3}>
      <TextField label="Фамилия" value={value.surname} onChange={(v) => onChange({ ...value, surname: v })} required error={errorFor(issues, `${path}.surname`)} />
      <TextField label="Имя" value={value.name} onChange={(v) => onChange({ ...value, name: v })} required error={errorFor(issues, `${path}.name`)} />
      <TextField label="Отчество" value={value.patronymic} onChange={(v) => onChange({ ...value, patronymic: v || undefined })} error={errorFor(issues, `${path}.patronymic`)} />
    </Grid>
  );
}

export function PersonEditor({ value, onChange, issues, path }: { value: Person; onChange: (v: Person) => void; issues: ValidationIssue[]; path: string }) {
  return (
    <div className="space-y-3">
      <FioFields value={value} onChange={onChange} issues={issues} path={path} />
      <TextField label="E-mail" value={value.email} onChange={(v) => onChange({ ...value, email: v || undefined })} type="email" error={errorFor(issues, `${path}.email`)} />
      <div className="text-sm font-medium text-[var(--text-secondary)]">Почтовый адрес</div>
      <AddressEditor value={value.postAddress} onChange={(postAddress) => onChange({ ...value, postAddress })} issues={issues} path={`${path}.postAddress`} postal />
    </div>
  );
}

export function EntrepreneurEditor({ value, onChange, issues, path, nopriz = false }: { value: Entrepreneur; onChange: (v: Entrepreneur) => void; issues: ValidationIssue[]; path: string; nopriz?: boolean }) {
  return (
    <div className="space-y-3">
      <FioFields value={value} onChange={onChange} issues={issues} path={path} />
      <Grid cols={3}>
        <TextField label="ОГРНИП" value={value.ogrnip} onChange={(v) => onChange({ ...value, ogrnip: v })} required hint="15 цифр" error={errorFor(issues, `${path}.ogrnip`)} />
        <TextField label="ИНН" value={value.inn} onChange={(v) => onChange({ ...value, inn: v || undefined })} hint="12 цифр" error={errorFor(issues, `${path}.inn`)} />
        <TextField label="E-mail" value={value.email} onChange={(v) => onChange({ ...value, email: v || undefined })} type="email" error={errorFor(issues, `${path}.email`)} />
      </Grid>
      {nopriz && (
        <TextField label="Реестровый номер НОПРИЗ" value={value.noprizNumber} onChange={(v) => onChange({ ...value, noprizNumber: v || undefined })} required placeholder="И-001-000000000001-2020 или «Не требуется»" error={errorFor(issues, `${path}.noprizNumber`)} />
      )}
      <div className="text-sm font-medium text-[var(--text-secondary)]">Почтовый адрес</div>
      <AddressEditor value={value.postAddress} onChange={(postAddress) => onChange({ ...value, postAddress })} issues={issues} path={`${path}.postAddress`} postal />
    </div>
  );
}

export function RepresentativeEditor({ value, onChange, issues, path }: { value: Representative; onChange: (v: Representative) => void; issues: ValidationIssue[]; path: string }) {
  return (
    <div className="space-y-3">
      <FioFields value={value} onChange={onChange} issues={issues} path={path} />
      <Grid cols={3}>
        <TextField label="Должность" value={value.position} onChange={(v) => onChange({ ...value, position: v })} required error={errorFor(issues, `${path}.position`)} />
        <TextField label="E-mail" value={value.email} onChange={(v) => onChange({ ...value, email: v || undefined })} type="email" error={errorFor(issues, `${path}.email`)} />
        <SelectField
          label="Роль подписанта"
          value={value.functionalRole}
          onChange={(v) => onChange({ ...value, functionalRole: v as Representative['functionalRole'] })}
          options={[
            { code: 'Утверждено', label: 'Утверждено' },
            { code: 'Согласовано', label: 'Согласовано' },
          ]}
          allowEmpty={false}
          required
        />
      </Grid>
    </div>
  );
}

export function ControlPersonEditor({ value, onChange, issues, path }: { value: ControlPerson; onChange: (v: ControlPerson) => void; issues: ValidationIssue[]; path: string }) {
  return (
    <div className="space-y-3">
      <FioFields value={value} onChange={onChange} issues={issues} path={path} />
      <TextField label="E-mail" value={value.email} onChange={(v) => onChange({ ...value, email: v || undefined })} type="email" error={errorFor(issues, `${path}.email`)} />
    </div>
  );
}
