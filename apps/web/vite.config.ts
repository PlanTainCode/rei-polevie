import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  // Vite по умолчанию пишет optimize cache в node_modules/.vite.
  // Иногда кеш повреждается и даёт белый экран из-за отсутствующих chunk-ов.
  // Переносим кеш в папку проекта, чтобы гарантированно пересоздавался.
  cacheDir: path.resolve(__dirname, '.vite-cache'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Модель XML-ТЗ живёт в API (попадает в его сборку), веб подключает её напрямую
      '@tz-xml': path.resolve(__dirname, '../api/src/modules/technical-tasks/tz-xml'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/generated': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});

