import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Copy, Check } from 'lucide-react';
import { companiesApi, invitationsApi } from '@/api/companies';
import { Button, Input, Select, Card, CardContent } from '@/components/ui';

interface InviteForm {
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'WORKER';
}

const ROLE_OPTIONS = [
  { value: 'WORKER', label: 'Сотрудник' },
  { value: 'MANAGER', label: 'Менеджер' },
  { value: 'ADMIN', label: 'Администратор' },
];

export function InviteMembersPage() {
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: company } = useQuery({
    queryKey: ['myCompany'],
    queryFn: companiesApi.getMyCompany,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteForm>({
    defaultValues: {
      role: 'WORKER',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: InviteForm) =>
      invitationsApi.create(company!.id, data),
    onSuccess: (invitation) => {
      const link = `${window.location.origin}/invite/${invitation.token}`;
      setInviteLink(link);
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      reset();
    },
    onError: (err: Error) => {
      setError(err.message || 'Ошибка создания приглашения');
    },
  });

  const onSubmit = (data: InviteForm) => {
    setError(null);
    setInviteLink(null);
    mutation.mutate(data);
  };

  const copyToClipboard = async () => {
    if (!inviteLink) return;
    
    try {
      // Пробуем современный API (работает только на HTTPS/localhost)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(inviteLink);
      } else {
        // Fallback для HTTP
        const textArea = document.createElement('textarea');
        textArea.value = inviteLink;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!company) {
    navigate('/company');
    return null;
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-500/20 flex items-center justify-center">
          <UserPlus className="w-8 h-8 text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Пригласить сотрудника</h1>
        <p className="text-[var(--text-secondary)]">
          Отправьте приглашение на email или поделитесь ссылкой
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {inviteLink && (
        <div className="mb-6 p-4 bg-primary-500/10 border border-primary-500/20 rounded-lg">
          <p className="text-sm text-primary-400 mb-2">
            Приглашение создано! Отправьте эту ссылку сотруднику:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-[var(--bg-tertiary)] rounded text-sm truncate">
              {inviteLink}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={copyToClipboard}
            >
              {copied ? (
                <Check className="w-4 h-4 text-primary-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email сотрудника"
              type="email"
              placeholder="employee@company.ru"
              error={errors.email?.message}
              {...register('email', {
                required: 'Email обязателен',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Некорректный email',
                },
              })}
            />

            <Select
              label="Роль"
              options={ROLE_OPTIONS}
              error={errors.role?.message}
              {...register('role')}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => navigate('/company')}
              >
                Назад
              </Button>
              <Button
                type="submit"
                className="flex-1"
                isLoading={mutation.isPending}
              >
                Создать приглашение
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

