import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Settings, User, Lock, Check, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/api/auth';
import { Button, Input, Card, CardContent } from '@/components/ui';

export function SettingsPage() {
  const { user, setUser } = useAuthStore();

  return (
    <div className="w-full max-w-2xl animate-fade-in page-content">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold">Настройки</h1>
        </div>
        <p className="text-[var(--text-secondary)]">
          Управление профилем и безопасностью аккаунта
        </p>
      </div>

      <div className="space-y-6">
        <ProfileForm user={user} onUpdate={setUser} />
        <PasswordForm />
      </div>
    </div>
  );
}

// === Форма профиля ===

function ProfileForm({
  user,
  onUpdate,
}: {
  user: { firstName: string; lastName: string; email: string } | null;
  onUpdate: (user: any) => void;
}) {
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () => authApi.updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() }),
    onSuccess: (updatedUser) => {
      onUpdate(updatedUser);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const hasChanges =
    firstName.trim() !== (user?.firstName || '') ||
    lastName.trim() !== (user?.lastName || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) return;
    mutation.mutate();
  };

  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <User className="w-4 h-4 text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold">Личные данные</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            value={user?.email || ''}
            disabled
            className="opacity-60"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Имя"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Введите имя"
            />
            <Input
              label="Фамилия"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Введите фамилию"
            />
          </div>

          {mutation.isError && (
            <StatusMessage
              type="error"
              message={getErrorMessage(mutation.error)}
            />
          )}

          {success && (
            <StatusMessage type="success" message="Данные успешно обновлены" />
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!hasChanges || mutation.isPending}
              isLoading={mutation.isPending}
            >
              Сохранить
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// === Форма пароля ===

function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [validationError, setValidationError] = useState('');

  const mutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (newPassword.length < 6) {
      setValidationError('Новый пароль должен быть не менее 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError('Пароли не совпадают');
      return;
    }

    mutation.mutate();
  };

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length > 0 &&
    confirmPassword.length > 0;

  return (
    <Card>
      <CardContent className="py-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Lock className="w-4 h-4 text-amber-400" />
          </div>
          <h2 className="text-lg font-semibold">Смена пароля</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Текущий пароль"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Введите текущий пароль"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Новый пароль"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Минимум 6 символов"
            />
            <Input
              label="Подтверждение пароля"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите новый пароль"
            />
          </div>

          {(validationError || mutation.isError) && (
            <StatusMessage
              type="error"
              message={validationError || getErrorMessage(mutation.error)}
            />
          )}

          {success && (
            <StatusMessage type="success" message="Пароль успешно изменён" />
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={!canSubmit || mutation.isPending}
              isLoading={mutation.isPending}
            >
              Сменить пароль
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// === Утилиты ===

function StatusMessage({ type, message }: { type: 'success' | 'error'; message: string }) {
  const isSuccess = type === 'success';
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
        isSuccess
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-red-500/10 text-red-400'
      }`}
    >
      {isSuccess ? (
        <Check className="w-4 h-4 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
      )}
      {message}
    </div>
  );
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const resp = (error as any).response?.data;
    if (resp?.message) {
      return Array.isArray(resp.message) ? resp.message[0] : resp.message;
    }
  }
  return 'Произошла ошибка. Попробуйте ещё раз';
}
