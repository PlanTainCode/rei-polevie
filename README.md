# Полевие

Приложение для автоматизации полевых выездов.

## Структура проекта

```
polevie/
├── apps/
│   ├── api/          # Backend (Nest.js)
│   ├── web/          # Frontend (React + Vite)
│   └── bot/          # Telegram Bot (Nest.js + Telegraf)
└── packages/
    └── shared/       # Общие типы и утилиты
```

## Технологии

- **Frontend**: React, Vite, TypeScript, TailwindCSS, React Query, Zustand
- **Backend**: Nest.js, TypeScript, Prisma, PostgreSQL
- **Telegram Bot**: Nest.js, Telegraf

## Начало работы

### Требования

- Node.js 18+
- Bun (пакетный менеджер)
- PostgreSQL

### Установка

```bash
# Установка зависимостей
bun install

# Настройка переменных окружения
cp apps/api/env.example apps/api/.env

# Генерация Prisma клиента
bun run db:generate

# Применение миграций
bun run db:push
```

### Запуск

```bash
# Запуск в режиме разработки
bun run dev

# Или по отдельности:
bun run dev:api   # Backend на порту 3001
bun run dev:web   # Frontend на порту 5173
```

## Функционал

### Реализовано

- [x] Структура monorepo
- [x] Авторизация и регистрация (JWT)
- [x] Создание компании
- [x] Приглашение сотрудников
- [x] Управление ролями

### В разработке

- [ ] Создание приказов
- [ ] Загрузка и парсинг Word документов
- [ ] Генерация проб с шифрами
- [ ] Генерация бирок (Excel)
- [ ] Распознавание координат с GPS фото
- [ ] Telegram Mini App
- [ ] Экспорт данных в Excel

## API Endpoints

### Auth
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `POST /api/auth/refresh` - Обновление токенов
- `GET /api/auth/profile` - Профиль пользователя

### Companies
- `POST /api/companies` - Создание компании
- `GET /api/companies/my` - Моя компания
- `GET /api/companies/:id/members` - Сотрудники компании

### Invitations
- `POST /api/invitations/company/:id` - Создание приглашения
- `GET /api/invitations/:token` - Информация о приглашении
- `POST /api/invitations/accept` - Принятие приглашения

