/**
 * Блоки конструктора: реквизиты и утверждение, объект, основание,
 * вид деятельности и этап, заказчик.
 */

import {
  CONSTRUCTION_TYPES,
  DANGER_INDUSTRIAL_CLASSES,
  ENERGY_EFFICIENCY_CLASSES,
  FIRE_DANGER_CATEGORIES,
  FOUNDATION_MATERIALS,
  FOUNDATION_TYPES,
  CABLE_MATERIALS,
  LAYING_METHODS,
  OBJECT_STATUSES,
  PIPE_MATERIALS,
  RESPONSIBILITY_LEVELS,
  SCALES,
  SECTION_RELIEFS,
  SECURITY_LABELS,
  SLEEPERS_MATERIALS,
  SURVEY_STAGES,
  emptyRepresentative,
  type ArealOks,
  type LinearKind,
  type LinearOks,
  type TzXmlModel,
} from '@tz-xml';
import { AddButton, Grid, MultiSelectField, RemoveButton, Section, SelectField, StringListField, TextAreaField, TextBlockField, TextField, Toggle, errorFor } from './fields';
import { AddressEditor, OrganizationEditor, PersonEditor, RepresentativeEditor } from './entities';
import type { BlockProps } from './types';

export function RequisitesBlock({ model, onChange, issues }: BlockProps) {
  const prov = model.provenance ?? {};
  const r = model.requisites;
  const setR = (patch: Partial<typeof r>) => onChange({ ...model, requisites: { ...r, ...patch } });
  const reps = model.approver.representatives;
  const setReps = (representatives: typeof reps) => onChange({ ...model, approver: { ...model.approver, representatives } });

  return (
    <div className="space-y-4">
      <Section title="Реквизиты документа">
        <Grid cols={3}>
          <TextField label="Шифр задания" value={r.number} onChange={(number) => setR({ number })} required placeholder="801-69-26-ЗИИ-1" provenance={prov['requisites.number']} error={errorFor(issues, 'requisites.number')} />
          <TextField label="Дата составления" type="date" value={r.date} onChange={(date) => setR({ date })} required error={errorFor(issues, 'requisites.date')} />
          <SelectField label="Гриф доступа" value={r.securityLabel} onChange={(securityLabel) => setR({ securityLabel })} options={SECURITY_LABELS} allowEmpty={false} required provenance={prov['requisites.securityLabel']} />
        </Grid>
        <Grid cols={3}>
          <TextField label="Номер версии документа" type="number" value={String(r.versionNumber)} onChange={(v) => setR({ versionNumber: Math.max(1, Number(v) || 1) })} hint="1 для первой редакции" />
        </Grid>
      </Section>

      <Section title="Утверждающая организация" description="Задание утверждает заказчик (застройщик или технический заказчик), а не исполнитель.">
        <OrganizationEditor value={model.approver.organization} onChange={(organization) => onChange({ ...model, approver: { ...model.approver, organization } })} issues={issues} path="approver.organization" nopriz provenance={prov['approver.organization']} />
      </Section>

      <Section title="Подписанты" description="Ровно один подписант с ролью «Утверждено»; остальные — «Согласовано».">
        {errorFor(issues, 'approver.representatives') && <p className="text-sm text-red-400">{errorFor(issues, 'approver.representatives')}</p>}
        {reps.map((rep, i) => (
          <div key={i} className="p-3 rounded-lg border border-[var(--border-color)] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Подписант {i + 1}</span>
              {reps.length > 1 && <RemoveButton onClick={() => setReps(reps.filter((_, j) => j !== i))} />}
            </div>
            <RepresentativeEditor value={rep} onChange={(v) => setReps(reps.map((x, j) => (j === i ? v : x)))} issues={issues} path={`approver.representatives[${i}]`} />
          </div>
        ))}
        <AddButton onClick={() => setReps([...reps, emptyRepresentative('Согласовано')])} label="Добавить подписанта" />
      </Section>
    </div>
  );
}

const LINEAR_KINDS: { code: LinearKind; label: string }[] = [
  { code: 'LINE_COMMUNICATION', label: 'Линия связи' },
  { code: 'LINE_POWER', label: 'Линия электропередачи' },
  { code: 'PIPELINE', label: 'Трубопровод' },
  { code: 'AUTOMOBILE_ROAD', label: 'Автомобильная дорога' },
  { code: 'LINE_RAILWAY', label: 'Железнодорожная линия' },
  { code: 'BRIDGE', label: 'Мост' },
];

export function ObjectBlock({ model, onChange, issues }: BlockProps) {
  const prov = model.provenance ?? {};
  const o = model.object;
  const setO = (patch: Partial<typeof o>) => onChange({ ...model, object: { ...o, ...patch } });
  const setAreal = (patch: Partial<ArealOks>) => setO({ areal: { ...o.areal, ...patch } });
  const setLinear = (patch: Partial<LinearOks>) => setO({ linear: { ...o.linear, ...patch } });
  const a = o.areal;
  const l = o.linear;
  const p = o.placement;

  return (
    <div className="space-y-4">
      <Section title="Объект капитального строительства">
        <TextAreaField label="Наименование объекта" value={o.name} onChange={(name) => setO({ name })} required rows={3} provenance={prov['object.name']} error={errorFor(issues, 'object.name')} hint="полностью, как в договоре" />
        <Grid cols={3}>
          <SelectField
            label="Тип объекта"
            value={o.kind}
            onChange={(kind) => setO({ kind: kind as typeof o.kind, siteKind: kind === 'LINEAR_OKS' ? 'LINEAR' : 'AREAL' })}
            options={[
              { code: 'AREAL_OKS', label: 'Площадной (здание, сооружение)' },
              { code: 'LINEAR_OKS', label: 'Линейный (сеть, дорога, трасса)' },
            ]}
            allowEmpty={false}
            required
            provenance={prov['object.kind']}
          />
          <SelectField label="Статус объекта" value={o.status} onChange={(status) => setO({ status })} options={OBJECT_STATUSES} allowEmpty={false} required error={errorFor(issues, 'object.status')} />
          <SelectField
            label="Уровень ответственности"
            value={o.kind === 'AREAL_OKS' ? a.responsibilityLevel : l.responsibilityLevel}
            onChange={(v) => (o.kind === 'AREAL_OKS' ? setAreal({ responsibilityLevel: v }) : setLinear({ responsibilityLevel: v }))}
            options={RESPONSIBILITY_LEVELS}
            allowEmpty={false}
            required
            provenance={prov[o.kind === 'AREAL_OKS' ? 'object.areal.responsibilityLevel' : 'object.linear.responsibilityLevel']}
          />
        </Grid>
        <TextField
          label="Код классификатора функционального назначения ОКС"
          value={o.kind === 'AREAL_OKS' ? a.functionsClass : l.functionsClass}
          onChange={(v) => (o.kind === 'AREAL_OKS' ? setAreal({ functionsClass: v }) : setLinear({ functionsClass: v }))}
          required
          placeholder="19.7.1.5"
          hint="по классификатору Минстроя, вид xx.xx.xxx.xxx"
          provenance={prov[o.kind === 'AREAL_OKS' ? 'object.areal.functionsClass' : 'object.linear.functionsClass']}
          error={errorFor(issues, 'object.areal.functionsClass') ?? errorFor(issues, 'object.linear.functionsClass')}
        />
      </Section>

      <Section title="Местоположение">
        <AddressEditor value={p.address} onChange={(address) => setO({ placement: { ...p, address } })} issues={issues} path="object.placement.address" provenance={prov['object.placement.address']} />
        <Grid cols={2}>
          <StringListField label="Кадастровые номера участков" values={p.cadastralSites} onChange={(cadastralSites) => setO({ placement: { ...p, cadastralSites } })} multiline={false} placeholder="77:04:0004008:1234" provenance={prov['object.placement.cadastralSites']} addLabel="Добавить участок" />
          <StringListField label="Кадастровые кварталы" values={p.cadastralDistricts} onChange={(cadastralDistricts) => setO({ placement: { ...p, cadastralDistricts } })} multiline={false} placeholder="77:04:0004008" addLabel="Добавить квартал" />
        </Grid>
      </Section>

      {o.kind === 'AREAL_OKS' ? (
        <>
          <Section title="Характеристики здания или сооружения">
            <TextAreaField label="Принадлежность к объектам транспортной инфраструктуры и другим объектам, влияющим на безопасность" value={a.functionsFeatures} onChange={(functionsFeatures) => setAreal({ functionsFeatures })} required rows={2} provenance={prov['object.areal.functionsFeatures']} error={errorFor(issues, 'object.areal.functionsFeatures')} />
            <Grid cols={3}>
              <SelectField label="Класс опасности ОПО" value={a.dangerousIndustrialObject} onChange={(dangerousIndustrialObject) => setAreal({ dangerousIndustrialObject })} options={DANGER_INDUSTRIAL_CLASSES} allowEmpty={false} required provenance={prov['object.areal.dangerousIndustrialObject']} />
              <SelectField label="Категория пожарной опасности" value={a.fireDangerCategory} onChange={(fireDangerCategory) => setAreal({ fireDangerCategory })} options={FIRE_DANGER_CATEGORIES} allowEmpty={false} required provenance={prov['object.areal.fireDangerCategory']} />
              <SelectField label="Класс энергоэффективности" value={a.energyEfficiency} onChange={(energyEfficiency) => setAreal({ energyEfficiency: energyEfficiency || undefined })} options={ENERGY_EFFICIENCY_CLASSES} emptyLabel="— не указывать —" />
            </Grid>
            <TextField label="Помещения с постоянным пребыванием людей" value={a.peoplePermanentStay} onChange={(peoplePermanentStay) => setAreal({ peoplePermanentStay })} required placeholder="Предусмотрено / Отсутствуют" provenance={prov['object.areal.peoplePermanentStay']} error={errorFor(issues, 'object.areal.peoplePermanentStay')} />
            <TextBlockField label="Конструктивные особенности" value={a.designFeatures} onChange={(designFeatures) => setAreal({ designFeatures })} required provenance={prov['object.areal.designFeatures']} error={errorFor(issues, 'object.areal.designFeatures')} />
            <Grid cols={4}>
              <TextField label="Ширина в плане, м" value={a.planSize.width} onChange={(width) => setAreal({ planSize: { ...a.planSize, width } })} required error={errorFor(issues, 'object.areal.planSize.width')} />
              <TextField label="Длина в плане, м" value={a.planSize.length} onChange={(length) => setAreal({ planSize: { ...a.planSize, length } })} required error={errorFor(issues, 'object.areal.planSize.length')} />
              <TextField label="Высота в плане, м" value={a.planSize.height} onChange={(height) => setAreal({ planSize: { ...a.planSize, height } })} required error={errorFor(issues, 'object.areal.planSize.height')} />
              <TextField label="Общая высота, м" value={a.overallHeight} onChange={(overallHeight) => setAreal({ overallHeight })} required provenance={prov['object.areal.overallHeight']} error={errorFor(issues, 'object.areal.overallHeight')} />
            </Grid>
            <Grid cols={4}>
              <TextField label="Количество этажей" value={a.numberFloors} onChange={(numberFloors) => setAreal({ numberFloors })} required provenance={prov['object.areal.numberFloors']} error={errorFor(issues, 'object.areal.numberFloors')} />
              <TextField label="Ориентировочная масса, т" value={a.approximateWeight} onChange={(approximateWeight) => setAreal({ approximateWeight })} required error={errorFor(issues, 'object.areal.approximateWeight')} />
              <TextField label="Глубина земляных работ, м" value={a.earthworksDepth} onChange={(earthworksDepth) => setAreal({ earthworksDepth: earthworksDepth || undefined })} provenance={prov['object.areal.earthworksDepth']} error={errorFor(issues, 'object.areal.earthworksDepth')} />
              <TextField label="Глубина подвала, м" value={a.basement} onChange={(basement) => setAreal({ basement: basement || undefined })} error={errorFor(issues, 'object.areal.basement')} />
            </Grid>
          </Section>

          <Section title="Фундамент">
            <Grid cols={2}>
              <MultiSelectField label="Тип фундамента" values={a.foundation.types} onChange={(types) => setAreal({ foundation: { ...a.foundation, types } })} options={FOUNDATION_TYPES} required columns={1} provenance={prov['object.areal.foundation.types']} error={errorFor(issues, 'object.areal.foundation.types')} />
              <MultiSelectField label="Материал фундамента" values={a.foundation.materials} onChange={(materials) => setAreal({ foundation: { ...a.foundation, materials } })} options={FOUNDATION_MATERIALS} required columns={1} provenance={prov['object.areal.foundation.materials']} error={errorFor(issues, 'object.areal.foundation.materials')} />
            </Grid>
            <Grid cols={3}>
              <TextField label="Размер фундамента, м" value={a.foundation.size} onChange={(size) => setAreal({ foundation: { ...a.foundation, size } })} required error={errorFor(issues, 'object.areal.foundation.size')} />
              <TextField label="Глубина заложения, м" value={a.foundation.depth} onChange={(depth) => setAreal({ foundation: { ...a.foundation, depth } })} required provenance={prov['object.areal.foundation.depth']} error={errorFor(issues, 'object.areal.foundation.depth')} />
              <TextField label="Сечение свай, мм" value={a.foundation.pilesCross} onChange={(pilesCross) => setAreal({ foundation: { ...a.foundation, pilesCross: pilesCross || undefined } })} placeholder="300х300" error={errorFor(issues, 'object.areal.foundation.pilesCross')} />
            </Grid>
            <Grid cols={3}>
              <TextField label="Нагрузка на сваю (куст), кН" value={a.foundation.load.pileLoad} onChange={(pileLoad) => setAreal({ foundation: { ...a.foundation, load: { ...a.foundation.load, pileLoad: pileLoad || undefined } } })} error={errorFor(issues, 'object.areal.foundation.load.pileLoad')} />
              <TextField label="Нагрузка на 1 п.м ленты, кН/м²" value={a.foundation.load.stripLoad} onChange={(stripLoad) => setAreal({ foundation: { ...a.foundation, load: { ...a.foundation.load, stripLoad: stripLoad || undefined } } })} error={errorFor(issues, 'object.areal.foundation.load.stripLoad')} />
              <TextField label="Нагрузка на грунты, кН/м²" value={a.foundation.load.soilLoad} onChange={(soilLoad) => setAreal({ foundation: { ...a.foundation, load: { ...a.foundation.load, soilLoad: soilLoad || undefined } } })} error={errorFor(issues, 'object.areal.foundation.load.soilLoad')} />
            </Grid>
            <Toggle label="Есть котлован" checked={!!a.foundationPit} onChange={(v) => setAreal({ foundationPit: v ? { depth: '', fence: '' } : undefined })} />
            {a.foundationPit && (
              <Grid cols={2}>
                <TextField label="Глубина котлована, м" value={a.foundationPit.depth} onChange={(depth) => setAreal({ foundationPit: { ...a.foundationPit!, depth } })} required error={errorFor(issues, 'object.areal.foundationPit.depth')} />
                <TextField label="Ограждение котлована" value={a.foundationPit.fence} onChange={(fence) => setAreal({ foundationPit: { ...a.foundationPit!, fence } })} required error={errorFor(issues, 'object.areal.foundationPit.fence')} />
              </Grid>
            )}
            <Grid cols={2}>
              <TextField label="Глубина сжимаемой толщи грунтов, м" value={a.compressibleSoilThickness} onChange={(v) => setAreal({ compressibleSoilThickness: v || undefined })} error={errorFor(issues, 'object.areal.compressibleSoilThickness')} />
              <TextField label="Допустимая осадка, см" value={a.permissibleDraft} onChange={(v) => setAreal({ permissibleDraft: v || undefined })} provenance={prov['object.areal.permissibleDraft']} error={errorFor(issues, 'object.areal.permissibleDraft')} />
            </Grid>
            <TextBlockField label="Конструкции ниже основного фундамента" value={a.structuresBelowFoundation} onChange={(v) => setAreal({ structuresBelowFoundation: v })} />
            <TextBlockField label="Предполагаемые статические и динамические нагрузки" value={a.loads} onChange={(v) => setAreal({ loads: v })} provenance={prov['object.areal.loads']} />
          </Section>
        </>
      ) : (
        <Section title="Характеристики линейного объекта">
          <Grid cols={2}>
            <TextField label="Протяжённость объекта, км" value={l.length} onChange={(length) => setLinear({ length })} required provenance={prov['object.linear.length']} error={errorFor(issues, 'object.linear.length')} />
            <SelectField label="Вид линейного объекта" value={l.kind} onChange={(kind) => setLinear({ kind: kind as LinearKind })} options={LINEAR_KINDS} allowEmpty={false} required />
          </Grid>
          {(l.kind === 'LINE_COMMUNICATION' || l.kind === 'PIPELINE') && (
            <Grid cols={2}>
              <SelectField label="Способ прокладки" value={l.layingMethod} onChange={(layingMethod) => setLinear({ layingMethod: layingMethod || undefined })} options={LAYING_METHODS} required error={errorFor(issues, 'object.linear.layingMethod')} />
              {l.kind === 'LINE_COMMUNICATION' ? (
                <SelectField label="Материал кабеля" value={l.cableMaterial} onChange={(cableMaterial) => setLinear({ cableMaterial: cableMaterial || undefined })} options={CABLE_MATERIALS} required error={errorFor(issues, 'object.linear.cableMaterial')} />
              ) : (
                <SelectField label="Материал трубы" value={l.pipeMaterial} onChange={(pipeMaterial) => setLinear({ pipeMaterial: pipeMaterial || undefined })} options={PIPE_MATERIALS} required error={errorFor(issues, 'object.linear.pipeMaterial')} />
              )}
            </Grid>
          )}
          {l.kind === 'LINE_COMMUNICATION' && (
            <Grid cols={2}>
              <TextField label="Глубина заложения кабеля, м" value={l.cableDepth} onChange={(cableDepth) => setLinear({ cableDepth: cableDepth || undefined })} error={errorFor(issues, 'object.linear.cableDepth')} />
              <TextField label="Глубина заложения фундамента, м" value={l.foundationDepth} onChange={(foundationDepth) => setLinear({ foundationDepth: foundationDepth || undefined })} error={errorFor(issues, 'object.linear.foundationDepth')} />
            </Grid>
          )}
          {l.kind === 'PIPELINE' && (
            <Grid cols={3}>
              <TextField label="Глубина заложения трубы, м" value={l.pipeDepth} onChange={(pipeDepth) => setLinear({ pipeDepth: pipeDepth || undefined })} error={errorFor(issues, 'object.linear.pipeDepth')} />
              <TextField label="Диаметр труб Dу, мм" value={l.pipeDiameter} onChange={(pipeDiameter) => setLinear({ pipeDiameter: pipeDiameter || undefined })} error={errorFor(issues, 'object.linear.pipeDiameter')} />
              <TextField label="Давление Pу, МПа" value={l.pressure} onChange={(pressure) => setLinear({ pressure: pressure || undefined })} error={errorFor(issues, 'object.linear.pressure')} />
            </Grid>
          )}
          {(l.kind === 'LINE_POWER' || l.kind === 'BRIDGE' || l.kind === 'LINE_COMMUNICATION') && (
            <>
              <Grid cols={2}>
                <MultiSelectField label="Тип фундамента" values={l.foundationTypes} onChange={(foundationTypes) => setLinear({ foundationTypes })} options={FOUNDATION_TYPES} required={l.kind !== 'LINE_COMMUNICATION'} columns={1} error={errorFor(issues, 'object.linear.foundationTypes')} />
                <MultiSelectField label="Материал фундамента" values={l.foundationMaterials} onChange={(foundationMaterials) => setLinear({ foundationMaterials })} options={FOUNDATION_MATERIALS} required={l.kind !== 'LINE_COMMUNICATION'} columns={1} error={errorFor(issues, 'object.linear.foundationMaterials')} />
              </Grid>
              {l.kind !== 'LINE_COMMUNICATION' && (
                <TextField label="Глубина заложения фундамента, м" value={l.foundationDepth} onChange={(foundationDepth) => setLinear({ foundationDepth: foundationDepth || undefined })} required error={errorFor(issues, 'object.linear.foundationDepth')} />
              )}
            </>
          )}
          {(l.kind === 'AUTOMOBILE_ROAD' || l.kind === 'LINE_RAILWAY') && (
            <Grid cols={2}>
              <TextField label="Высота насыпи, м" value={l.embankmentHeight} onChange={(embankmentHeight) => setLinear({ embankmentHeight: embankmentHeight || undefined })} required error={errorFor(issues, 'object.linear.embankmentHeight')} />
              {l.kind === 'LINE_RAILWAY' && <SelectField label="Материал шпал" value={l.sleepersMaterial} onChange={(sleepersMaterial) => setLinear({ sleepersMaterial: sleepersMaterial || undefined })} options={SLEEPERS_MATERIALS} required error={errorFor(issues, 'object.linear.sleepersMaterial')} />}
            </Grid>
          )}
        </Section>
      )}

      <Section title="Площадка или трасса изысканий" description="Схема требует параметры основной площадки (или трассы) отдельно от объекта.">
        <SelectField
          label="Что снимаем"
          value={o.siteKind}
          onChange={(siteKind) => setO({ siteKind: siteKind as typeof o.siteKind })}
          options={[
            { code: 'AREAL', label: 'Площадка' },
            { code: 'LINEAR', label: 'Трасса' },
          ]}
          allowEmpty={false}
        />
        {o.siteKind === 'AREAL' ? (
          <Grid cols={4}>
            <TextField label="Ширина площадки, м" value={o.arealSite.planSize.width} onChange={(width) => setO({ arealSite: { ...o.arealSite, planSize: { ...o.arealSite.planSize, width } } })} required error={errorFor(issues, 'object.arealSite.planSize.width')} />
            <TextField label="Длина площадки, м" value={o.arealSite.planSize.length} onChange={(length) => setO({ arealSite: { ...o.arealSite, planSize: { ...o.arealSite.planSize, length } } })} required error={errorFor(issues, 'object.arealSite.planSize.length')} />
            <SelectField label="Масштаб съёмки" value={o.arealSite.shootingScale} onChange={(shootingScale) => setO({ arealSite: { ...o.arealSite, shootingScale } })} options={SCALES} allowEmpty={false} required provenance={prov['object.arealSite.shootingScale']} />
            <SelectField label="Сечение рельефа, м" value={o.arealSite.sectionRelief} onChange={(sectionRelief) => setO({ arealSite: { ...o.arealSite, sectionRelief } })} options={SECTION_RELIEFS} allowEmpty={false} required />
          </Grid>
        ) : (
          <Grid cols={4}>
            <TextField label="Протяжённость трассы, км" value={o.linearSite.length} onChange={(length) => setO({ linearSite: { ...o.linearSite, length } })} required error={errorFor(issues, 'object.linearSite.length')} />
            <TextField label="Ширина полосы съёмки, м" value={o.linearSite.shootingWidth} onChange={(shootingWidth) => setO({ linearSite: { ...o.linearSite, shootingWidth } })} required error={errorFor(issues, 'object.linearSite.shootingWidth')} />
            <SelectField label="Масштаб съёмки" value={o.linearSite.shootingScale} onChange={(shootingScale) => setO({ linearSite: { ...o.linearSite, shootingScale } })} options={SCALES} allowEmpty={false} required />
            <SelectField label="Масштаб плана профиля" value={o.linearSite.scalePlanProfile} onChange={(scalePlanProfile) => setO({ linearSite: { ...o.linearSite, scalePlanProfile } })} options={SCALES} allowEmpty={false} required />
            <SelectField label="Сечение рельефа, м" value={o.linearSite.sectionRelief} onChange={(sectionRelief) => setO({ linearSite: { ...o.linearSite, sectionRelief } })} options={SECTION_RELIEFS} allowEmpty={false} required />
          </Grid>
        )}
        {o.siteKind === 'AREAL' ? (
          <TextBlockField label="Дополнительные или особые требования к площадке" value={o.arealSite.additionalRequirements} onChange={(v) => setO({ arealSite: { ...o.arealSite, additionalRequirements: v } })} />
        ) : (
          <TextBlockField label="Дополнительные или особые требования к трассе" value={o.linearSite.additionalRequirements} onChange={(v) => setO({ linearSite: { ...o.linearSite, additionalRequirements: v } })} />
        )}
      </Section>
    </div>
  );
}

export function ConstructionBlock({ model, onChange, issues }: BlockProps) {
  const prov = model.provenance ?? {};
  return (
    <div className="space-y-4">
      <Section title="Вид градостроительной деятельности и этап">
        <Grid cols={2}>
          <SelectField label="Вид градостроительной деятельности" value={model.constructionType} onChange={(constructionType) => onChange({ ...model, constructionType })} options={CONSTRUCTION_TYPES} allowEmpty={false} required provenance={prov['constructionType']} error={errorFor(issues, 'constructionType')} />
          <SelectField label="Этап выполнения инженерных изысканий" value={model.stage} onChange={(stage) => onChange({ ...model, stage })} options={SURVEY_STAGES} allowEmpty={false} required provenance={prov['stage']} error={errorFor(issues, 'stage')} />
        </Grid>
      </Section>
      <Section title="Сроки" actions={<Toggle label="Указать сроки" checked={model.enabled.timePeriod} onChange={(timePeriod) => onChange({ ...model, enabled: { ...model.enabled, timePeriod } })} />}>
        {model.enabled.timePeriod && (
          <TextAreaField label="Сведения о сроках выполнения работ по изысканиям, проектирования и эксплуатации объекта" value={model.timePeriod} onChange={(timePeriod) => onChange({ ...model, timePeriod })} rows={3} provenance={prov['timePeriod']} />
        )}
      </Section>
    </div>
  );
}

export function CustomerBlock({ model, onChange, issues }: BlockProps) {
  const prov = model.provenance ?? {};
  const hasDeveloper = model.customerKind === 'DEVELOPER' || model.customerKind === 'BOTH';
  const hasTechnicalCustomer = model.customerKind === 'TECHNICAL_CUSTOMER' || model.customerKind === 'BOTH';
  return (
    <div className="space-y-4">
      <Section title="Кто выступает заказчиком задания">
        <Grid cols={2}>
          <SelectField
            label="Заказчик"
            value={model.customerKind}
            onChange={(customerKind) => onChange({ ...model, customerKind: customerKind as typeof model.customerKind })}
            options={[
              { code: 'DEVELOPER', label: 'Застройщик' },
              { code: 'TECHNICAL_CUSTOMER', label: 'Технический заказчик' },
              { code: 'BOTH', label: 'Застройщик и технический заказчик' },
            ]}
            allowEmpty={false}
            error={errorFor(issues, 'customerKind')}
          />
          {hasDeveloper && (
            <SelectField
              label="Застройщик — это"
              value={model.developer.kind}
              onChange={(kind) => onChange({ ...model, developer: { ...model.developer, kind: kind as typeof model.developer.kind } })}
              options={[
                { code: 'ORGANIZATION', label: 'Юридическое лицо' },
                { code: 'PERSON', label: 'Физическое лицо' },
              ]}
              allowEmpty={false}
            />
          )}
        </Grid>
      </Section>
      {hasDeveloper && (
        model.developer.kind === 'ORGANIZATION' ? (
          <Section title="Застройщик (юридическое лицо)">
            <OrganizationEditor value={model.developer.organization} onChange={(organization) => onChange({ ...model, developer: { ...model.developer, organization } })} issues={issues} path="developer.organization" provenance={prov['developer.organization']} />
          </Section>
        ) : (
          <Section title="Застройщик (физическое лицо)">
            <PersonEditor value={model.developer.person} onChange={(person) => onChange({ ...model, developer: { ...model.developer, person } })} issues={issues} path="developer.person" />
          </Section>
        )
      )}
      {hasTechnicalCustomer && (
        <Section title="Технический заказчик" description="Организация должна состоять в реестре НОПРИЗ.">
          <OrganizationEditor value={model.technicalCustomer} onChange={(technicalCustomer) => onChange({ ...model, technicalCustomer })} issues={issues} path="technicalCustomer" nopriz provenance={prov['technicalCustomer']} />
        </Section>
      )}
    </div>
  );
}

export const OBJECT_BLOCK_IDS = ['requisites', 'object', 'construction', 'customer'] as const;
export type { TzXmlModel };
