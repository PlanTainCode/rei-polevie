import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { companiesApi } from '@/api/companies';
import { useAuthStore } from '@/store/auth';
import { Button, Input, Card, CardContent } from '@/components/ui';

interface CreateCompanyForm {
  name: string;
  inn?: string;
}

export function CreateCompanyPage() {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refreshProfile } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateCompanyForm>();

  const mutation = useMutation({
    mutationFn: companiesApi.create,
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['myCompany'] });
      navigate('/dashboard');
    },
    onError: (err: Error) => {
      setError(err.message || 'Ошибка создания компании');
    },
  });

  const onSubmit = (data: CreateCompanyForm) => {
    setError(null);
    mutation.mutate(data);
  };

  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-500/20 flex items-center justify-center">
          <Building2 className="w-8 h-8 text-primary-400" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Создание компании</h1>
        <p className="text-[var(--text-secondary)]">
          Заполните данные для регистрации компании
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="py-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Название компании"
              placeholder="ООО «Геология»"
              error={errors.name?.message}
              {...register('name', {
                required: 'Название обязательно',
              })}
            />

            <Input
              label="ИНН (необязательно)"
              placeholder="1234567890"
              error={errors.inn?.message}
              {...register('inn', {
                pattern: {
                  value: /^\d{10}$|^\d{12}$/,
                  message: 'ИНН должен содержать 10 или 12 цифр',
                },
              })}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => navigate(-1)}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                className="flex-1"
                isLoading={mutation.isPending}
              >
                Создать
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

