import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, Users, UserPlus, Mail, Trash2 } from 'lucide-react';
import { companiesApi, invitationsApi } from '@/api/companies';
import { useAuthStore } from '@/store/auth';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Владелец',
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  WORKER: 'Сотрудник',
};

export function CompanyPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: company, isLoading } = useQuery({
    queryKey: ['myCompany'],
    queryFn: companiesApi.getMyCompany,
  });

  const { data: invitations } = useQuery({
    queryKey: ['invitations', company?.id],
    queryFn: () => invitationsApi.getCompanyInvitations(company!.id),
    enabled: !!company?.id && ['OWNER', 'ADMIN'].includes(company?.myRole || ''),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!company) {
    navigate('/company/create');
    return null;
  }

  const canManageMembers = ['OWNER', 'ADMIN'].includes(company.myRole);

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Компания</h1>
        <p className="text-[var(--text-secondary)]">
          Управление компанией и сотрудниками
        </p>
      </div>

      {/* Информация о компании */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary-400" />
            </div>
            <div>
              <CardTitle>{company.name}</CardTitle>
              <p className="text-sm text-[var(--text-secondary)]">
                {company.inn ? `ИНН: ${company.inn}` : 'ИНН не указан'}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Сотрудники */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--text-secondary)]" />
            <CardTitle>Сотрудники</CardTitle>
          </div>
          {canManageMembers && (
            <Button size="sm" onClick={() => navigate('/company/invite')}>
              <UserPlus className="w-4 h-4" />
              Пригласить
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-[var(--border-color)]">
            {company.members?.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                    <span className="text-sm font-medium">
                      {member.user.firstName[0]}
                      {member.user.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">
                      {member.user.firstName} {member.user.lastName}
                      {member.user.id === user?.id && (
                        <span className="text-[var(--text-secondary)]"> (вы)</span>
                      )}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {member.user.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      member.role === 'OWNER'
                        ? 'bg-primary-500/20 text-primary-400'
                        : member.role === 'ADMIN'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {ROLE_LABELS[member.role]}
                  </span>
                  {canManageMembers &&
                    member.role !== 'OWNER' &&
                    member.user.id !== user?.id && (
                      <button className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Приглашения */}
      {canManageMembers && invitations && invitations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-[var(--text-secondary)]" />
              <CardTitle>Ожидающие приглашения</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[var(--border-color)]">
              {invitations.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <div>
                    <p className="font-medium">{invite.email}</p>
                    <p className="text-sm text-[var(--text-secondary)]">
                      Роль: {ROLE_LABELS[invite.role]} • Истекает:{' '}
                      {new Date(invite.expiresAt).toLocaleDateString('ru')}
                    </p>
                  </div>
                  <button className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

