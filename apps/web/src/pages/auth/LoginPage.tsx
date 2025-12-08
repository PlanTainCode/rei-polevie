import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '@/store/auth';
import { Button, Input } from '@/components/ui';

interface LoginForm {
  email: string;
  password: string;
}

export function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuthStore();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    try {
      setError(null);
      await login(data.email, data.password);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ошибка входа. Проверьте данные и попробуйте снова.');
      }
    }
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold mb-2">Вход в аккаунт</h2>
      <p className="text-[var(--text-secondary)] mb-8">
        Введите свои данные для входа в систему
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password', {
            required: 'Пароль обязателен',
          })}
        />

        <Button type="submit" className="w-full" isLoading={isSubmitting}>
          Войти
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
        Нет аккаунта?{' '}
        <Link to="/register" className="text-primary-400 hover:text-primary-300">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
}

