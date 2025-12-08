import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Building2, CheckCircle, AlertCircle } from 'lucide-react';
import { invitationsApi } from '@/api/companies';
import { Button, Input } from '@/components/ui';

interface AcceptForm {
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
}

export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    data: invitation,
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => invitationsApi.getByToken(token!),
    enabled: !!token,
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AcceptForm>();

  const password = watch('password');

  useEffect(() => {
    if (fetchError) {
      setError('Приглашение недействительно или срок его действия истёк');
    }
  }, [fetchError]);

  const onSubmit = async (data: AcceptForm) => {
    if (!token) return;

    try {
      setError(null);
      await invitationsApi.accept({
        token,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ошибка принятия приглашения');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="animate-fade-in text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-500/20 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-primary-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Добро пожаловать!</h2>
        <p className="text-[var(--text-secondary)] mb-6">
          Вы успешно присоединились к компании
        </p>
        <Button onClick={() => navigate('/login')} className="w-full">
          Войти в систему
        </Button>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="animate-fade-in text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Ошибка</h2>
        <p className="text-[var(--text-secondary)] mb-6">
          {error || 'Приглашение не найдено'}
        </p>
        <Link to="/login">
          <Button variant="secondary" className="w-full">
            Перейти к входу
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-primary-500/20 flex items-center justify-center">
          <Building2 className="w-7 h-7 text-primary-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Приглашение в компанию</h2>
        <p className="text-[var(--text-secondary)]">
          Вас пригласили в{' '}
          <span className="text-[var(--text-primary)] font-medium">
            {invitation.company.name}
          </span>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Имя"
            placeholder="Иван"
            error={errors.firstName?.message}
            {...register('firstName', {
              required: 'Имя обязательно',
            })}
          />

          <Input
            label="Фамилия"
            placeholder="Иванов"
            error={errors.lastName?.message}
            {...register('lastName', {
              required: 'Фамилия обязательна',
            })}
          />
        </div>

        <Input
          label="Email"
          type="email"
          value={invitation.email}
          disabled
        />

        <Input
          label="Пароль"
          type="password"
          placeholder="Минимум 6 символов"
          error={errors.password?.message}
          {...register('password', {
            required: 'Пароль обязателен',
            minLength: {
              value: 6,
              message: 'Пароль должен быть не менее 6 символов',
            },
          })}
        />

        <Input
          label="Подтверждение пароля"
          type="password"
          placeholder="Повторите пароль"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword', {
            required: 'Подтвердите пароль',
            validate: (value) =>
              value === password || 'Пароли не совпадают',
          })}
        />

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Принять приглашение
        </Button>
      </form>
    </div>
  );
}

