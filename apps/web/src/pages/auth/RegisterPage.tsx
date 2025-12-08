import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '@/store/auth';
import { Button, Input } from '@/components/ui';

interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
}

export function RegisterPage() {
  const [error, setError] = useState<string | null>(null);
  const { register: registerUser } = useAuthStore();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>();

  const password = watch('password');

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError(null);
      await registerUser({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
      });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ошибка регистрации. Попробуйте снова.');
      }
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold mb-2">Регистрация</h2>
      <p className="text-[var(--text-secondary)] mb-8">
        Создайте аккаунт для работы с системой
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

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
          placeholder="example@company.ru"
          error={errors.email?.message}
          {...register('email', {
            required: 'Email обязателен',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Некорректный email',
            },
          })}
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
          Зарегистрироваться
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
        Уже есть аккаунт?{' '}
        <Link to="/login" className="text-primary-400 hover:text-primary-300">
          Войти
        </Link>
      </p>
    </div>
  );
}

