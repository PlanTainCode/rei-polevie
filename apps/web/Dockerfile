FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Копируем файлы для установки зависимостей
COPY package.json bun.lock bunfig.toml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Устанавливаем зависимости
RUN bun install --frozen-lockfile

# Копируем исходный код
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Собираем приложение
WORKDIR /app/apps/web
RUN bun run build

# ========== NGINX ==========
FROM nginx:alpine AS runner

# Копируем конфиг nginx
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Копируем собранные файлы
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

