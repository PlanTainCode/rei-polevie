FROM oven/bun:1-alpine AS base

# Установка необходимых системных пакетов
# LibreOffice нужен для конвертации Word -> PDF (справки)
# MS Core Fonts нужны для корректного рендеринга шаблонов (Times New Roman, Arial и т.д.)
RUN apk add --no-cache openssl libreoffice-writer ttf-liberation font-noto fontconfig && \
    apk add --no-cache --virtual .font-deps curl cabextract && \
    mkdir -p /usr/share/fonts/truetype/msttcorefonts && \
    for f in andale32 arial32 arialb32 comic32 courie32 georgi32 impact32 times32 trebuc32 verdan32 webdin32; do \
      curl -sLo /tmp/$f.exe "https://downloads.sourceforge.net/corefonts/$f.exe" && \
      cabextract -q -d /tmp/fonts /tmp/$f.exe 2>/dev/null || true; \
    done && \
    find /tmp/fonts -iname '*.ttf' -exec mv {} /usr/share/fonts/truetype/msttcorefonts/ \; 2>/dev/null; \
    fc-cache -f && \
    rm -rf /tmp/fonts /tmp/*.exe && \
    apk del .font-deps

WORKDIR /app

# ========== BUILDER ==========
FROM base AS builder

# Копируем файлы для установки зависимостей
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Устанавливаем зависимости
RUN bun install

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
RUN bun install --production

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
CMD ["sh", "-c", "bunx prisma db push --skip-generate && bun run start:prod"]

