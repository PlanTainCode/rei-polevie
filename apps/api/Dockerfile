FROM oven/bun:1-alpine AS base

# Установка необходимых системных пакетов
RUN apk add --no-cache openssl

WORKDIR /app

# ========== BUILDER ==========
FROM base AS builder

# Копируем файлы для установки зависимостей
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Устанавливаем зависимости
RUN bun install --frozen-lockfile

# Копируем исходный код
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Генерируем Prisma Client
RUN cd apps/api && bunx prisma generate

# Собираем API
RUN cd apps/api && bun run build

# ========== RUNNER ==========
FROM base AS runner

# Создаём непривилегированного пользователя
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

WORKDIR /app

# Копируем package.json и зависимости
COPY --from=builder /app/package.json ./
COPY --from=builder /app/bun.lock ./
COPY --from=builder /app/bunfig.toml ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/shared ./packages/shared

# Устанавливаем только production зависимости
RUN bun install --frozen-lockfile --production

# Копируем собранное приложение и Prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/templates ./apps/api/templates
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Создаём директории для файлов с правильными правами
RUN mkdir -p /app/apps/api/uploads /app/apps/api/generated && \
    chown -R nestjs:nodejs /app/apps/api/uploads /app/apps/api/generated

USER nestjs

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Запуск с миграциями
CMD ["sh", "-c", "bunx prisma migrate deploy && bun run start:prod"]

