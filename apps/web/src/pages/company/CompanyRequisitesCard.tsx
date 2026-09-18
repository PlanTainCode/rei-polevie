/**
 * Реквизиты компании для XML-заданий: организация (ИНН, КПП, ОГРН, адрес,
 * НОПРИЗ) и подписант со стороны исполнителя. Подставляются в новые ТЗ.
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Save } from 'lucide-react';
import { emptyOrganization, validateModel, createEmptyModel, type CompanyRequisites, type ValidationIssue } from '@tz-xml';
import { companiesApi } from '@/api/companies';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { OrganizationEditor } from '@/pages/technical-tasks/editor/entities';
import { Grid, TextField } from '@/pages/technical-tasks/editor/fields';

function emptyRequisites(): CompanyRequisites {
  return { organization: { ...emptyOrganization(), noprizNumber: '' }, signatory: { surname: '', name: '', position: '' } };
}

/** Проверяем организацию теми же правилами, что и в задании (как исполнителя с НОПРИЗ). */
function validateRequisites(r: CompanyRequisites): ValidationIssue[] {
  const m = createEmptyModel();
  m.enabled.researchers = true;
  m.researchers = [{ kind: 'ORGANIZATION', organization: r.organization, entrepreneur: { surname: '', name: '', ogrnip: '', postAddress: emptyOrganization().address }, contract: { number: 'x', date: '2026-01-01', files: [{ fileUrl: 'x', name: 'x.pdf', format: 'pdf', checksum: '00000000' }] } }];
  return validateModel(m)
    .filter((i) => i.path.startsWith('researchers[0].organization'))
    .map((i) => ({ ...i, path: i.path.replace('researchers[0].organization', 'organization') }));
}

export function CompanyRequisitesCard({ companyId, initial, canEdit }: { companyId: string; initial: CompanyRequisites | null; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<CompanyRequisites>(initial ?? emptyRequisites());
  const [dirty, setDirty] = useState(false);
  const issues = validateRequisites(value);

  const saveMutation = useMutation({
    mutationFn: () => companiesApi.updateRequisites(companyId, value as unknown as Record<string, unknown>),
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['myCompany'] });
    },
  });

  const update = (v: CompanyRequisites) => {
    setValue(v);
    setDirty(true);
  };
  const signatory = value.signatory ?? { surname: '', name: '', position: '' };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" /> Реквизиты для заданий на изыскания
          </span>
          {canEdit && (
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending} isLoading={saveMutation.isPending}>
              <Save className="w-4 h-4" /> Сохранить
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-[var(--text-secondary)]">Подставляются в новые XML-задания как исполнитель изысканий. Организация должна состоять в реестре НОПРИЗ.</p>
        <div className={canEdit ? '' : 'pointer-events-none opacity-70'}>
          <OrganizationEditor value={value.organization} onChange={(organization) => update({ ...value, organization })} issues={issues} path="organization" nopriz />
          <div className="mt-5 space-y-3">
            <div className="text-sm font-medium">Подписант со стороны исполнителя</div>
            <Grid cols={4}>
              <TextField label="Фамилия" value={signatory.surname} onChange={(surname) => update({ ...value, signatory: { ...signatory, surname } })} />
              <TextField label="Имя" value={signatory.name} onChange={(name) => update({ ...value, signatory: { ...signatory, name } })} />
              <TextField label="Отчество" value={signatory.patronymic} onChange={(patronymic) => update({ ...value, signatory: { ...signatory, patronymic: patronymic || undefined } })} />
              <TextField label="Должность" value={signatory.position} onChange={(position) => update({ ...value, signatory: { ...signatory, position } })} />
            </Grid>
          </div>
        </div>
        {saveMutation.isError && <p className="text-sm text-red-400">Не удалось сохранить реквизиты</p>}
        {saveMutation.isSuccess && !dirty && <p className="text-sm text-emerald-400">Сохранено</p>}
      </CardContent>
    </Card>
  );
}
