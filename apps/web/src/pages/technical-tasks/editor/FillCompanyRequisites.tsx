import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { fillEmptyOrganizationFields, organizationIdentifiersConflict, type CompanyRequisites, type Organization } from '@tz-xml';
import { companiesApi } from '@/api/companies';
import { Button } from '@/components/ui';

export function FillCompanyRequisites({ value, onChange, readOnly = false }: {
  value: Organization;
  onChange: (organization: Organization) => void;
  readOnly?: boolean;
}) {
  const [message, setMessage] = useState('');
  const company = useQuery({ queryKey: ['myCompany'], queryFn: companiesApi.getMyCompany, enabled: !readOnly });
  const source = (company.data?.requisites as CompanyRequisites | null | undefined)?.organization;
  const available = Boolean(source?.fullName?.trim());

  const fill = () => {
    if (readOnly || !source || !available) return;
    if (organizationIdentifiersConflict(value, source)) {
      setMessage('ИНН, КПП или регистрационный номер отличаются от реквизитов компании. Для своей компании добавьте отдельного исполнителя.');
      return;
    }
    const next = fillEmptyOrganizationFields(value, source);
    if (JSON.stringify(next) === JSON.stringify(value)) {
      setMessage('Нет пустых полей, которые можно дополнить из реквизитов компании.');
      return;
    }
    onChange(next);
    setMessage('Пустые поля заполнены. Ранее введённые значения сохранены.');
  };

  if (readOnly) return null;
  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" size="sm" onClick={fill} disabled={!available || company.isFetching} isLoading={company.isFetching}>
        <Building2 className="w-4 h-4" /> Заполнить из реквизитов компании
      </Button>
      {company.isError ? (
        <p className="text-sm text-red-400">
          Не удалось загрузить реквизиты. <button type="button" className="underline" onClick={() => void company.refetch()}>Повторить</button>
        </p>
      ) : !company.isPending && !available ? (
        <p className="text-sm text-amber-300">
          Сначала сохраните данные в разделе <Link to="/company" className="underline">«Компания → Реквизиты для заданий на изыскания»</Link>.
        </p>
      ) : null}
      {message && <p role="status" className="text-sm text-[var(--text-secondary)]">{message}</p>}
    </div>
  );
}
