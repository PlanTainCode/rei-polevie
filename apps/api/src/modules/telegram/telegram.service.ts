import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup, Context } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';
import { SampleStatus } from '@prisma/client';
import * as exifr from 'exifr';
import heicConvert from 'heic-convert';
import { AiService } from '../ai/ai.service';
import { PhotosService } from '../projects/photos.service';
import * as bcrypt from 'bcrypt';

interface BotContext extends Context {
  session?: {
    // Авторизация
    userId?: string;
    companyId?: string;
    isAuthorized?: boolean;
    awaitingAuth?: 'email' | 'password';
    pendingEmail?: string;
    // Навигация
    selectedProjectId?: string;
    selectedPlatformId?: string;
    editingSampleId?: string;
    editingPlatformId?: string;
    awaitingInput?: 'description' | 'platform_lat' | 'platform_lon' | 'platform_photo' | 'platform_gps_photo';
    // Режим загрузки фото
    uploadingPhotos?: boolean;
    uploadedPhotosCount?: number;
    lastUploadedPhotoId?: string; // ID последнего загруженного фото для привязки голосового
  };
}

// Временное хранилище сессий (в памяти)
const sessions = new Map<number, BotContext['session']>();

// Список характеристик проб
const SOIL_DESCRIPTIONS = [
  'глина',
  'суглинок',
  'супесь',
  'песок',
  'торф',
  'ил',
  'гравий',
  'чернозём',
  'насыпной грунт',
  'строительный мусор',
];

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf<BotContext>;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private aiService: AiService,
    @Inject(forwardRef(() => PhotosService))
    private photosService: PhotosService,
  ) {}

  async onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN не задан, бот не запущен');
      return;
    }

    this.bot = new Telegraf<BotContext>(token);
    this.setupMiddleware();
    this.setupCommands();
    this.setupCallbacks();
    this.setupTextHandlers();

    // Запускаем бота
    this.bot.launch()
      .then(() => this.logger.log('🤖 Telegram бот запущен'))
      .catch((err) => this.logger.error('Ошибка запуска бота:', err));
  }

  async onModuleDestroy() {
    if (this.bot) {
      this.bot.stop('SIGTERM');
    }
  }

  private setupMiddleware() {
    // Middleware для сессий
    this.bot.use(async (ctx, next) => {
      const chatId = ctx.chat?.id;
      if (chatId) {
        ctx.session = sessions.get(chatId) || {};
        await next();
        sessions.set(chatId, ctx.session);
      } else {
        await next();
      }
    });

    // Middleware для обработки ошибок callback queries
    this.bot.use(async (ctx, next) => {
      try {
        await next();
      } catch (error: unknown) {
        const err = error as Error;
        // Игнорируем ошибки устаревших callback queries
        if (err.message?.includes('query is too old') || 
            err.message?.includes('query ID is invalid')) {
          this.logger.warn('Устаревший callback query, игнорируем');
          return;
        }
        throw error;
      }
    });
  }

  private setupCommands() {
    // /start — проверка авторизации и приветствие
    this.bot.start(async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (!telegramId) {
        await ctx.reply('❌ Не удалось определить ваш Telegram ID');
        return;
      }

      // Проверяем, авторизован ли пользователь по telegramId
      const user = await this.prisma.user.findUnique({
        where: { telegramId },
        include: {
          companyMemberships: {
            include: { company: true },
            take: 1,
          },
        },
      });

      if (user && user.companyMemberships.length > 0) {
        // Пользователь уже авторизован
        ctx.session = ctx.session || {};
        ctx.session.isAuthorized = true;
        ctx.session.userId = user.id;
        ctx.session.companyId = user.companyMemberships[0].companyId;

        const firstName = ctx.from?.first_name || user.firstName;
        await ctx.reply(
          `👋 С возвращением, ${firstName}!\n\n` +
          `🏢 Компания: ${user.companyMemberships[0].company.name}\n\n` +
          `📋 Доступные команды:\n` +
          `/projects — список проектов\n` +
          `/logout — выйти из аккаунта\n` +
          `/help — справка`,
          Markup.keyboard([
            ['📁 Проекты'],
            ['ℹ️ Помощь', '🚪 Выход'],
          ]).resize(),
        );
      } else {
        // Нужна авторизация
        ctx.session = ctx.session || {};
        ctx.session.isAuthorized = false;
        ctx.session.awaitingAuth = 'email';

        await ctx.reply(
          `👋 Добро пожаловать!\n\n` +
          `Для работы с ботом необходимо авторизоваться.\n\n` +
          `📧 Введите ваш email:`,
          Markup.removeKeyboard(),
        );
      }
    });

    // /logout — выход из аккаунта
    this.bot.command('logout', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (telegramId) {
        // Удаляем telegramId из пользователя
        await this.prisma.user.updateMany({
          where: { telegramId },
          data: { telegramId: null },
        });
      }

      // Очищаем сессию
      ctx.session = {};
      sessions.delete(ctx.from?.id || 0);

      await ctx.reply(
        '✅ Вы вышли из аккаунта.\n\n' +
        'Для повторного входа нажмите /start',
        Markup.removeKeyboard(),
      );
    });

    // /help — справка
    this.bot.help(async (ctx) => {
      if (!await this.checkAuth(ctx)) return;
      
      await ctx.reply(
        `📖 Справка по боту\n\n` +
        `Этот бот позволяет:\n` +
        `• Просматривать проекты и пробы\n` +
        `• Вносить координаты GPS для площадок\n` +
        `• Указывать характеристику проб\n` +
        `• Отмечать пробы как отобранные\n\n` +
        `Для начала выберите проект командой /projects`,
      );
    });

    // /projects — список проектов
    this.bot.command('projects', async (ctx) => {
      if (!await this.checkAuth(ctx)) return;
      await this.showProjects(ctx);
    });
  }

  private setupCallbacks() {
    // Выбор проекта
    this.bot.action(/^project:(.+)$/, async (ctx) => {
      const projectId = ctx.match[1];
      ctx.session = ctx.session || {};
      ctx.session.selectedProjectId = projectId;
      await ctx.answerCbQuery();
      await this.showProjectMenu(ctx, projectId);
    });

    // Меню проекта: показать площадки
    this.bot.action(/^platforms:(.+)$/, async (ctx) => {
      const projectId = ctx.match[1];
      await ctx.answerCbQuery();
      await this.showPlatforms(ctx, projectId);
    });

    // Выбор площадки — показываем меню площадки
    this.bot.action(/^platform:(.+)$/, async (ctx) => {
      const platformId = ctx.match[1];
      ctx.session = ctx.session || {};
      ctx.session.selectedPlatformId = platformId;
      await ctx.answerCbQuery();
      await this.showPlatformMenu(ctx, platformId);
    });

    // Показать пробы площадки
    this.bot.action(/^platform_samples:(.+)$/, async (ctx) => {
      const platformId = ctx.match[1];
      await ctx.answerCbQuery();
      await this.showSamples(ctx, platformId);
    });

    // Ввод координат площадки
    this.bot.action(/^platform_lat:(.+)$/, async (ctx) => {
      const platformId = ctx.match[1];
      ctx.session = ctx.session || {};
      ctx.session.editingPlatformId = platformId;
      ctx.session.awaitingInput = 'platform_lat';
      await ctx.answerCbQuery();
      await ctx.reply(
        '📍 Введите широту для площадки (например: 55 50.792)\n\n' +
        'Или отправьте геолокацию 📍',
      );
    });

    this.bot.action(/^platform_lon:(.+)$/, async (ctx) => {
      const platformId = ctx.match[1];
      ctx.session = ctx.session || {};
      ctx.session.editingPlatformId = platformId;
      ctx.session.awaitingInput = 'platform_lon';
      await ctx.answerCbQuery();
      await ctx.reply('📍 Введите долготу для площадки (например: 37 39.277):');
    });

    // Координаты из EXIF фото (автоматически)
    this.bot.action(/^platform_photo:(.+)$/, async (ctx) => {
      const platformId = ctx.match[1];
      ctx.session = ctx.session || {};
      ctx.session.editingPlatformId = platformId;
      ctx.session.awaitingInput = 'platform_photo';
      await ctx.answerCbQuery();
      await ctx.reply(
        '📷 Отправьте фотографию *как файл* (через 📎 → Файл)\n\n' +
        '⚠️ Важно: фото должно содержать GPS-координаты\n' +
        '(обычно это фото с телефона с включённой геолокацией)',
        { parse_mode: 'Markdown' },
      );
    });

    // Координаты с фото GPS-трекера (через AI распознавание)
    this.bot.action(/^platform_gps_photo:(.+)$/, async (ctx) => {
      const platformId = ctx.match[1];
      ctx.session = ctx.session || {};
      ctx.session.editingPlatformId = platformId;
      ctx.session.awaitingInput = 'platform_gps_photo';
      await ctx.answerCbQuery();
      await ctx.reply(
        '📱 Отправьте фото экрана GPS-трекера\n\n' +
        'Можно отправить как *фото* или как *файл*\n' +
        'AI распознает координаты с экрана',
        { parse_mode: 'Markdown' },
      );
    });

    // Выбор пробы для редактирования
    this.bot.action(/^sample:(.+)$/, async (ctx) => {
      const sampleId = ctx.match[1];
      await ctx.answerCbQuery();
      await this.showSampleDetails(ctx, sampleId);
    });

    // Показать список характеристик для выбора
    this.bot.action(/^edit_desc:(.+)$/, async (ctx) => {
      const sampleId = ctx.match[1];
      await ctx.answerCbQuery();
      await this.showDescriptionPicker(ctx, sampleId);
    });

    // Выбор характеристики из списка
    this.bot.action(/^set_desc:(.+):(.+)$/, async (ctx) => {
      const sampleId = ctx.match[1];
      const descIndex = parseInt(ctx.match[2], 10);
      await ctx.answerCbQuery();
      await this.setDescription(ctx, sampleId, descIndex);
    });

    // Отметить как отобранную
    this.bot.action(/^collect:(.+)$/, async (ctx) => {
      const sampleId = ctx.match[1];
      await ctx.answerCbQuery();
      await this.collectSample(ctx, sampleId);
    });

    // Назад к проекту
    this.bot.action(/^back_project:(.+)$/, async (ctx) => {
      const projectId = ctx.match[1];
      await ctx.answerCbQuery();
      await this.showProjectMenu(ctx, projectId);
    });

    // Назад к площадкам
    this.bot.action(/^back_platforms:(.+)$/, async (ctx) => {
      const projectId = ctx.match[1];
      await ctx.answerCbQuery();
      await this.showPlatforms(ctx, projectId);
    });

    // Назад к меню площадки
    this.bot.action(/^back_platform:(.+)$/, async (ctx) => {
      const platformId = ctx.match[1];
      await ctx.answerCbQuery();
      await this.showPlatformMenu(ctx, platformId);
    });

    // Назад к пробам
    this.bot.action(/^back_samples:(.+)$/, async (ctx) => {
      const platformId = ctx.match[1];
      await ctx.answerCbQuery();
      await this.showSamples(ctx, platformId);
    });

    // Назад к списку проектов
    this.bot.action('back_projects', async (ctx) => {
      await ctx.answerCbQuery();
      await this.showProjects(ctx);
    });

    // ============ ФОТОАЛЬБОМ ============

    // Показать меню фотоальбома
    this.bot.action(/^photos:(.+)$/, async (ctx) => {
      const projectId = ctx.match[1];
      await ctx.answerCbQuery();
      await this.showPhotosMenu(ctx, projectId);
    });

    // Начать загрузку фото
    this.bot.action(/^upload_photos:(.+)$/, async (ctx) => {
      const projectId = ctx.match[1];
      ctx.session = ctx.session || {};
      ctx.session.selectedProjectId = projectId;
      ctx.session.uploadingPhotos = true;
      ctx.session.uploadedPhotosCount = 0;
      await ctx.answerCbQuery();
      await ctx.reply(
        '📷 *Режим загрузки фото*\n\n' +
        'Отправляйте фотографии *как файлы* (📎 → Файл)\n' +
        'чтобы сохранить GPS-координаты и качество.\n\n' +
        'Когда закончите — нажмите кнопку ниже.',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Закончить загрузку', `finish_upload:${projectId}`)],
            [Markup.button.callback('❌ Отмена', `photos:${projectId}`)],
          ]),
        },
      );
    });

    // Завершить загрузку фото
    this.bot.action(/^finish_upload:(.+)$/, async (ctx) => {
      const projectId = ctx.match[1];
      const uploaded = ctx.session?.uploadedPhotosCount || 0;
      
      ctx.session = ctx.session || {};
      ctx.session.uploadingPhotos = false;
      ctx.session.uploadedPhotosCount = 0;
      
      await ctx.answerCbQuery();
      
      if (uploaded > 0) {
        await ctx.reply(`✅ Загружено фото: ${uploaded}`);
      }
      
      await this.showPhotosMenu(ctx, projectId);
    });
  }

  private setupTextHandlers() {
    // Кнопка "Проекты"
    this.bot.hears('📁 Проекты', async (ctx) => {
      if (!await this.checkAuth(ctx)) return;
      await this.showProjects(ctx);
    });
    
    this.bot.hears('ℹ️ Помощь', async (ctx) => {
      if (!await this.checkAuth(ctx)) return;
      await ctx.reply(
        `📖 Справка по боту\n\n` +
        `Этот бот позволяет:\n` +
        `• Просматривать проекты и пробы\n` +
        `• Вносить координаты GPS для площадок\n` +
        `• Указывать характеристику проб\n` +
        `• Отмечать пробы как отобранные\n\n` +
        `Для начала выберите проект командой /projects`,
      );
    });

    // Кнопка выхода
    this.bot.hears('🚪 Выход', async (ctx) => {
      const telegramId = ctx.from?.id?.toString();
      if (telegramId) {
        await this.prisma.user.updateMany({
          where: { telegramId },
          data: { telegramId: null },
        });
      }
      ctx.session = {};
      sessions.delete(ctx.from?.id || 0);
      await ctx.reply(
        '✅ Вы вышли из аккаунта.\n\nДля повторного входа нажмите /start',
        Markup.removeKeyboard(),
      );
    });

    // Обработка текстового ввода (авторизация и координаты)
    this.bot.on('text', async (ctx) => {
      const session = ctx.session || {};
      const text = ctx.message.text.trim();

      // Обработка авторизации
      if (session.awaitingAuth === 'email') {
        await this.handleEmailInput(ctx, text);
        return;
      }
      
      if (session.awaitingAuth === 'password') {
        await this.handlePasswordInput(ctx, text);
        return;
      }

      // Проверка авторизации для других действий
      if (!session.isAuthorized) {
        await ctx.reply('❌ Сначала авторизуйтесь. Нажмите /start');
        return;
      }

      // Обработка ввода координат площадки
      if (!session.awaitingInput || !session.editingPlatformId) {
        return;
      }

      const platformId = session.editingPlatformId;
      const inputType = session.awaitingInput;

      try {
        if (inputType === 'platform_lat') {
          await this.updatePlatformCoordinates(platformId, text, null);
          session.awaitingInput = undefined;
          await ctx.reply('✅ Широта сохранена для всех проб площадки!');
          await this.showPlatformMenu(ctx, platformId);
        } else if (inputType === 'platform_lon') {
          await this.updatePlatformCoordinates(platformId, null, text);
          session.awaitingInput = undefined;
          await ctx.reply('✅ Долгота сохранена для всех проб площадки!');
          await this.showPlatformMenu(ctx, platformId);
        }
      } catch (error) {
        this.logger.error('Ошибка сохранения координат:', error);
        await ctx.reply('❌ Ошибка сохранения. Попробуйте снова.');
      }
    });

    // Обработка геолокации — сохраняем для площадки
    this.bot.on('location', async (ctx) => {
      const session = ctx.session;
      if (!session?.editingPlatformId) {
        await ctx.reply('Сначала выберите площадку для ввода координат');
        return;
      }

      const { latitude, longitude } = ctx.message.location;
      
      // Конвертируем в десятичный формат (как на GPS-трекере)
      const latStr = this.formatCoordinate(latitude, false);
      const lonStr = this.formatCoordinate(longitude, true);

      try {
        await this.updatePlatformCoordinates(session.editingPlatformId, latStr, lonStr);
        session.awaitingInput = undefined;
        
        await ctx.reply(`✅ Координаты сохранены для всех проб площадки:\n📍 ${latStr}, ${lonStr}`);
        await this.showPlatformMenu(ctx, session.editingPlatformId);
      } catch (error) {
        this.logger.error('Ошибка сохранения координат:', error);
        await ctx.reply('❌ Ошибка сохранения координат');
      }
    });

    // Обработка документов (файлов) — извлекаем GPS из EXIF, загрузка в фотоальбом или через AI
    this.bot.on('document', async (ctx) => {
      const session = ctx.session;
      const awaitingPhoto = session?.awaitingInput === 'platform_photo';
      const awaitingGpsPhoto = session?.awaitingInput === 'platform_gps_photo';
      const uploadingPhotos = session?.uploadingPhotos && session?.selectedProjectId;
      
      // Режим загрузки фото в фотоальбом
      if (uploadingPhotos) {
        await this.handlePhotoUpload(ctx);
        return;
      }
      
      if (!session?.editingPlatformId || (!awaitingPhoto && !awaitingGpsPhoto)) {
        return;
      }

      // Если ожидаем фото GPS-трекера — обрабатываем через AI
      if (awaitingGpsPhoto) {
        await this.handleGpsTrackerDocument(ctx, session.editingPlatformId);
        return;
      }

      const document = ctx.message.document;
      const mimeType = document.mime_type || '';
      const fileName = document.file_name || '';
      
      // Поддерживаемые форматы: JPEG, HEIC/HEIF (Apple), PNG, TIFF
      const supportedMimes = [
        'image/jpeg',
        'image/jpg', 
        'image/heic',
        'image/heif',
        'image/png',
        'image/tiff',
      ];
      
      const supportedExtensions = ['.jpg', '.jpeg', '.heic', '.heif', '.png', '.tiff', '.tif'];
      const extension = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
      
      const isSupported = supportedMimes.includes(mimeType.toLowerCase()) || 
                          supportedExtensions.includes(extension);
      
      if (!isSupported) {
        await ctx.reply(
          '❌ Неподдерживаемый формат файла\n\n' +
          'Поддерживаются: JPEG, HEIC, PNG, TIFF',
        );
        return;
      }

      try {
        await ctx.reply('⏳ Извлекаю координаты из фото...');

        // Получаем ссылку на файл
        const fileLink = await ctx.telegram.getFileLink(document.file_id);
        
        // Скачиваем файл
        const response = await fetch(fileLink.href);
        let buffer = Buffer.from(await response.arrayBuffer());

        this.logger.log(`Обработка файла: ${fileName}, mime: ${mimeType}, size: ${buffer.length}`);

        // Проверяем, является ли файл HEIC/HEIF
        const isHeic = mimeType.toLowerCase().includes('heic') || 
                       mimeType.toLowerCase().includes('heif') ||
                       extension === '.heic' || 
                       extension === '.heif';

        // Извлекаем GPS из EXIF (сначала пробуем из оригинала)
        let gps: { latitude: number; longitude: number } | undefined;
        
        // Попытка 1: извлечь из оригинального файла
        try {
          gps = await exifr.gps(buffer);
          this.logger.log(`GPS из оригинала: ${JSON.stringify(gps)}`);
        } catch (parseError) {
          this.logger.warn(`exifr.gps failed: ${parseError}`);
        }

        // Попытка 2: через exifr.parse
        if (!gps) {
          try {
            const parsed = await exifr.parse(buffer, { gps: true });
            if (parsed?.latitude && parsed?.longitude) {
              gps = { latitude: parsed.latitude, longitude: parsed.longitude };
              this.logger.log(`GPS через parse: ${JSON.stringify(gps)}`);
            }
          } catch (parseError) {
            this.logger.warn(`exifr.parse failed: ${parseError}`);
          }
        }

        // Попытка 3: если HEIC и GPS не найден — конвертируем и пробуем снова
        if (!gps && isHeic) {
          this.logger.log('GPS не найден в HEIC, пробуем конвертацию...');
          try {
            const convertedBuffer = await heicConvert({
              buffer: new Uint8Array(buffer).buffer,
              format: 'JPEG',
              quality: 0.9,
            });
            const jpegBuffer = Buffer.from(convertedBuffer);
            this.logger.log(`HEIC сконвертирован, размер: ${jpegBuffer.length}`);
            
            gps = await exifr.gps(jpegBuffer);
            this.logger.log(`GPS из сконвертированного: ${JSON.stringify(gps)}`);
          } catch (convertError) {
            this.logger.error('Ошибка конвертации/парсинга HEIC:', convertError);
          }
        }
        
        if (!gps || !gps.latitude || !gps.longitude) {
          await ctx.reply(
            '❌ GPS-координаты не найдены в фото\n\n' +
            'Убедитесь что:\n' +
            '• Фото сделано с включённой геолокацией\n' +
            '• На iPhone: Настройки → Конфиденциальность → Службы геолокации → Камера\n' +
            '• Фото отправлено как файл (📎 → Файл)',
          );
          return;
        }

        // Конвертируем в десятичный формат (как на GPS-трекере)
        const latStr = this.formatCoordinate(gps.latitude, false);
        const lonStr = this.formatCoordinate(gps.longitude, true);

        // Сохраняем координаты
        await this.updatePlatformCoordinates(session.editingPlatformId, latStr, lonStr);
        session.awaitingInput = undefined;

        await ctx.reply(
          `✅ Координаты из фото сохранены!\n\n` +
          `📍 Широта: ${latStr}\n` +
          `📍 Долгота: ${lonStr}`,
        );
        await this.showPlatformMenu(ctx, session.editingPlatformId);
      } catch (error) {
        this.logger.error('Ошибка извлечения GPS из фото:', error);
        await ctx.reply(
          '❌ Не удалось извлечь координаты из фото\n\n' +
          'Попробуйте:\n' +
          '• Отправить фото в формате JPEG\n' +
          '• На iPhone: сконвертировать HEIC в JPEG перед отправкой',
        );
      }
    });

    // Обработка фото GPS-трекера (через AI Vision)
    this.bot.on('photo', async (ctx) => {
      const session = ctx.session;
      if (!session?.editingPlatformId || session?.awaitingInput !== 'platform_gps_photo') {
        return;
      }

      try {
        await ctx.reply('🤖 Распознаю координаты с фото GPS-трекера...');

        // Получаем самое большое фото
        const photos = ctx.message.photo;
        const largestPhoto = photos[photos.length - 1];
        
        // Получаем ссылку на файл
        const fileLink = await ctx.telegram.getFileLink(largestPhoto.file_id);
        
        // Скачиваем и конвертируем в base64
        const response = await fetch(fileLink.href);
        const buffer = Buffer.from(await response.arrayBuffer());
        const base64 = buffer.toString('base64');

        this.logger.log(`Отправка фото GPS-трекера в AI, размер: ${buffer.length}`);

        // Распознаём координаты через AI
        const coords = await this.aiService.extractCoordinatesFromPhoto(base64);

        if (!coords) {
          await ctx.reply(
            '❌ Не удалось распознать координаты\n\n' +
            'Убедитесь что:\n' +
            '• На фото виден экран GPS-трекера\n' +
            '• Координаты чётко видны\n' +
            '• Фото не размытое',
          );
          return;
        }

        // Сохраняем координаты
        await this.updatePlatformCoordinates(session.editingPlatformId, coords.latitude, coords.longitude);
        session.awaitingInput = undefined;

        await ctx.reply(
          `✅ Координаты распознаны и сохранены!\n\n` +
          `📍 Широта: ${coords.latitude}\n` +
          `📍 Долгота: ${coords.longitude}\n` +
          `📊 Формат: ${coords.format}`,
        );
        await this.showPlatformMenu(ctx, session.editingPlatformId);
      } catch (error) {
        this.logger.error('Ошибка распознавания координат с GPS-трекера:', error);
        await ctx.reply('❌ Ошибка распознавания. Попробуйте снова.');
      }
    });

    // Обработка голосовых сообщений — расшифровка для описания фото
    this.bot.on('voice', async (ctx) => {
      const session = ctx.session;
      
      // Проверяем что мы в режиме загрузки фото и есть последнее загруженное фото
      if (!session?.uploadingPhotos || !session?.lastUploadedPhotoId) {
        return;
      }

      try {
        await ctx.reply('🎤 Расшифровываю голосовое сообщение...');

        const voice = ctx.message.voice;
        
        // Скачиваем голосовое сообщение
        const fileLink = await ctx.telegram.getFileLink(voice.file_id);
        const response = await fetch(fileLink.href);
        const buffer = Buffer.from(await response.arrayBuffer());

        this.logger.log(`Расшифровка голосового: ${buffer.length} bytes, duration: ${voice.duration}s`);

        // Расшифровываем через AI
        const transcription = await this.aiService.transcribeAudio(buffer);

        if (!transcription) {
          await ctx.reply('❌ Не удалось расшифровать голосовое сообщение');
          return;
        }

        // Обновляем описание фото
        await this.photosService.updatePhoto(session.lastUploadedPhotoId, {
          description: transcription,
        });

        await ctx.reply(
          `✅ Описание добавлено:\n\n_"${transcription}"_`,
          { parse_mode: 'Markdown' },
        );

        // Сбрасываем lastUploadedPhotoId чтобы следующее голосовое не перезаписало
        session.lastUploadedPhotoId = undefined;
      } catch (error) {
        this.logger.error('Ошибка расшифровки голосового:', error);
        await ctx.reply('❌ Ошибка расшифровки. Попробуйте снова.');
      }
    });
  }

  // ========== АВТОРИЗАЦИЯ ==========

  /**
   * Проверяет авторизацию пользователя
   * Если не авторизован — отправляет сообщение и возвращает false
   */
  private async checkAuth(ctx: BotContext): Promise<boolean> {
    const telegramId = ctx.from?.id?.toString();
    
    // Проверяем сессию
    if (ctx.session?.isAuthorized && ctx.session?.companyId) {
      return true;
    }

    // Проверяем в базе по telegramId
    if (telegramId) {
      const user = await this.prisma.user.findUnique({
        where: { telegramId },
        include: {
          companyMemberships: { take: 1 },
        },
      });

      if (user && user.companyMemberships.length > 0) {
        ctx.session = ctx.session || {};
        ctx.session.isAuthorized = true;
        ctx.session.userId = user.id;
        ctx.session.companyId = user.companyMemberships[0].companyId;
        return true;
      }
    }

    await ctx.reply(
      '❌ Вы не авторизованы.\n\n' +
      'Нажмите /start для входа в систему.',
    );
    return false;
  }

  /**
   * Обработка ввода email при авторизации
   */
  private async handleEmailInput(ctx: BotContext, email: string) {
    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await ctx.reply('❌ Неверный формат email. Попробуйте снова:');
      return;
    }

    // Проверяем существование пользователя
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      await ctx.reply(
        '❌ Пользователь с таким email не найден.\n\n' +
        '📧 Введите email ещё раз или зарегистрируйтесь на сайте:',
      );
      return;
    }

    // Сохраняем email и переходим к паролю
    ctx.session = ctx.session || {};
    ctx.session.pendingEmail = email.toLowerCase();
    ctx.session.awaitingAuth = 'password';

    await ctx.reply('🔐 Введите пароль:');
  }

  /**
   * Обработка ввода пароля при авторизации
   */
  private async handlePasswordInput(ctx: BotContext, password: string) {
    const session = ctx.session;
    if (!session?.pendingEmail) {
      session!.awaitingAuth = 'email';
      await ctx.reply('❌ Ошибка. Введите email заново:');
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { email: session.pendingEmail },
      include: {
        companyMemberships: {
          include: { company: true },
          take: 1,
        },
      },
    });

    if (!user) {
      session.awaitingAuth = 'email';
      session.pendingEmail = undefined;
      await ctx.reply('❌ Пользователь не найден. Введите email:');
      return;
    }

    // Проверяем пароль
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await ctx.reply('❌ Неверный пароль. Попробуйте снова:');
      return;
    }

    // Проверяем наличие компании
    if (user.companyMemberships.length === 0) {
      session.awaitingAuth = undefined;
      session.pendingEmail = undefined;
      await ctx.reply(
        '❌ Вы не состоите ни в одной компании.\n\n' +
        'Обратитесь к администратору для добавления в компанию.',
      );
      return;
    }

    // Успешная авторизация — сохраняем telegramId
    const telegramId = ctx.from?.id?.toString();
    if (telegramId) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { telegramId },
      });
    }

    // Обновляем сессию
    session.isAuthorized = true;
    session.userId = user.id;
    session.companyId = user.companyMemberships[0].companyId;
    session.awaitingAuth = undefined;
    session.pendingEmail = undefined;

    await ctx.reply(
      `✅ Авторизация успешна!\n\n` +
      `👤 ${user.firstName} ${user.lastName}\n` +
      `🏢 ${user.companyMemberships[0].company.name}\n\n` +
      `Теперь вы можете работать с проектами.`,
      Markup.keyboard([
        ['📁 Проекты'],
        ['ℹ️ Помощь', '🚪 Выход'],
      ]).resize(),
    );
  }

  // ========== МЕТОДЫ ОТОБРАЖЕНИЯ ==========

  private async showProjects(ctx: BotContext) {
    const companyId = ctx.session?.companyId;
    
    if (!companyId) {
      await ctx.reply('❌ Ошибка: компания не определена. Нажмите /start');
      return;
    }

    // Показываем только проекты компании пользователя
    const projects = await this.prisma.project.findMany({
      where: { 
        companyId,
        status: { in: ['ACTIVE', 'IN_PROGRESS'] },
      },
      include: {
        _count: { select: { samples: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (projects.length === 0) {
      await ctx.reply('📭 Нет активных проектов в вашей компании');
      return;
    }

    const buttons = projects.map((p) => [
      Markup.button.callback(
        `📁 ${p.name} (${p._count.samples} проб)`,
        `project:${p.id}`,
      ),
    ]);

    await ctx.reply(
      '📋 Выберите проект:',
      Markup.inlineKeyboard(buttons),
    );
  }

  private async showProjectMenu(ctx: BotContext, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: {
            samples: true,
            platforms: true,
            photos: true,
          },
        },
        samples: {
          where: { status: 'COLLECTED' },
        },
      },
    });

    if (!project) {
      await ctx.reply('❌ Проект не найден');
      return;
    }

    const collectedCount = project.samples.length;
    const totalCount = project._count.samples;
    const progress = totalCount > 0 ? Math.round((collectedCount / totalCount) * 100) : 0;
    const photosCount = project._count.photos;

    const text = 
      `📁 *${this.escapeMarkdown(project.name)}*\n\n` +
      `📍 ${project.objectAddress || 'Адрес не указан'}\n` +
      `📊 Прогресс: ${collectedCount}/${totalCount} проб (${progress}%)\n` +
      `🏷️ Площадок: ${project._count.platforms}\n` +
      `📷 Фото: ${photosCount}`;

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📋 Площадки и пробы', `platforms:${projectId}`)],
        [Markup.button.callback(`📷 Фотоальбом (${photosCount})`, `photos:${projectId}`)],
        [Markup.button.callback('◀️ К списку проектов', 'back_projects')],
      ]),
    }).catch(() => {
      ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📋 Площадки и пробы', `platforms:${projectId}`)],
          [Markup.button.callback(`📷 Фотоальбом (${photosCount})`, `photos:${projectId}`)],
          [Markup.button.callback('◀️ К списку проектов', 'back_projects')],
        ]),
      });
    });
  }

  private async showPlatforms(ctx: BotContext, projectId: string) {
    const platforms = await this.prisma.platform.findMany({
      where: { projectId },
      include: {
        _count: { select: { samples: true } },
        samples: {
          where: { status: 'COLLECTED' },
          select: { id: true },
        },
      },
      orderBy: [{ type: 'asc' }, { number: 'asc' }],
    });

    if (platforms.length === 0) {
      await ctx.editMessageText('📭 В проекте нет площадок', {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('◀️ Назад', `back_project:${projectId}`)],
        ]),
      });
      return;
    }

    const buttons = platforms.map((p) => {
      const collected = p.samples.length;
      const total = p._count.samples;
      const icon = collected === total && total > 0 ? '✅' : '📍';
      return [
        Markup.button.callback(
          `${icon} ${p.label} (${collected}/${total})`,
          `platform:${p.id}`,
        ),
      ];
    });

    buttons.push([Markup.button.callback('◀️ К проекту', `back_project:${projectId}`)]);

    await ctx.editMessageText(
      '📍 Выберите площадку:',
      Markup.inlineKeyboard(buttons),
    ).catch(() => {
      ctx.reply('📍 Выберите площадку:', Markup.inlineKeyboard(buttons));
    });
  }

  /**
   * Меню площадки — координаты и пробы
   */
  private async showPlatformMenu(ctx: BotContext, platformId: string) {
    const platform = await this.prisma.platform.findUnique({
      where: { id: platformId },
      include: {
        project: { select: { id: true, name: true } },
        samples: {
          orderBy: [{ layerNumber: 'asc' }, { analysisCode: 'asc' }],
          take: 1, // Берём первую пробу для отображения координат
        },
        _count: { select: { samples: true } },
      },
    });

    if (!platform) {
      await ctx.reply('❌ Площадка не найдена');
      return;
    }

    // Берём координаты из первой пробы (они одинаковые для всех)
    const firstSample = platform.samples[0];
    const latitude = firstSample?.latitude || '—';
    const longitude = firstSample?.longitude || '—';
    const hasCoords = firstSample?.latitude && firstSample?.longitude;

    // Считаем собранные пробы
    const collectedSamples = await this.prisma.sample.count({
      where: { platformId, status: 'COLLECTED' },
    });

    const coordsIcon = hasCoords ? '✅' : '❌';
    const text = 
      `📍 *Площадка ${platform.label}*\n` +
      `_${this.escapeMarkdown(platform.project.name)}_\n\n` +
      `🧪 Проб: ${collectedSamples}/${platform._count.samples} собрано\n\n` +
      `🌐 *Координаты* ${coordsIcon}\n` +
      `  Широта: ${latitude}\n` +
      `  Долгота: ${longitude}`;

    const buttons = [
      [Markup.button.callback('📱 Фото GPS-трекера', `platform_gps_photo:${platformId}`)],
      [Markup.button.callback('📷 Авто из EXIF', `platform_photo:${platformId}`)],
      [
        Markup.button.callback('📍 Широта', `platform_lat:${platformId}`),
        Markup.button.callback('📍 Долгота', `platform_lon:${platformId}`),
      ],
      [Markup.button.callback(`🧪 Пробы (${platform._count.samples})`, `platform_samples:${platformId}`)],
      [Markup.button.callback('◀️ К площадкам', `back_platforms:${platform.project.id}`)],
    ];

    // Сохраняем ID площадки для геолокации
    if (ctx.session) {
      ctx.session.editingPlatformId = platformId;
    }

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    }).catch(() => {
      ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    });
  }

  private async showSamples(ctx: BotContext, platformId: string) {
    const platform = await this.prisma.platform.findUnique({
      where: { id: platformId },
      include: {
        project: { select: { id: true, name: true } },
        samples: {
          orderBy: [{ layerNumber: 'asc' }, { analysisCode: 'asc' }],
        },
      },
    });

    if (!platform) {
      await ctx.reply('❌ Площадка не найдена');
      return;
    }

    if (platform.samples.length === 0) {
      await ctx.editMessageText(`📭 На площадке ${platform.label} нет проб`, {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('◀️ К площадке', `back_platform:${platformId}`)],
        ]),
      });
      return;
    }

    const buttons = platform.samples.map((s) => {
      const statusIcon = s.status === 'COLLECTED' ? '✅' : '⬜';
      const descIcon = s.description ? '📝' : '';
      return [
        Markup.button.callback(
          `${statusIcon} ${s.cipher} | ${s.depthLabel} ${descIcon}`,
          `sample:${s.id}`,
        ),
      ];
    });

    buttons.push([
      Markup.button.callback('◀️ К площадке', `back_platform:${platformId}`),
    ]);

    await ctx.editMessageText(
      `🧪 *${platform.label}* — пробы:\n` +
      `_${this.escapeMarkdown(platform.project.name)}_`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      },
    ).catch(() => {
      ctx.reply(
        `🧪 *${platform.label}* — пробы:\n` +
        `_${this.escapeMarkdown(platform.project.name)}_`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons),
        },
      );
    });
  }

  private async showSampleDetails(ctx: BotContext, sampleId: string) {
    const sample = await this.prisma.sample.findUnique({
      where: { id: sampleId },
      include: {
        platform: {
          include: {
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!sample) {
      await ctx.reply('❌ Проба не найдена');
      return;
    }

    const statusIcon = sample.status === 'COLLECTED' ? '✅' : '⬜';
    const text =
      `🏷️ *Проба ${this.escapeMarkdown(sample.cipher)}*\n\n` +
      `📍 Площадка: ${sample.platform.label}\n` +
      `📏 Глубина: ${sample.depthLabel}\n` +
      `⚖️ Масса: ${sample.mass}\n` +
      `📝 Характеристика: ${sample.description || '—'}\n\n` +
      `Статус: ${statusIcon} ${sample.status === 'COLLECTED' ? 'Отобрана' : 'Ожидает'}`;

    const buttons = [
      [Markup.button.callback('📝 Характеристика', `edit_desc:${sampleId}`)],
    ];

    if (sample.status !== 'COLLECTED') {
      buttons.push([Markup.button.callback('✅ Отметить отобранной', `collect:${sampleId}`)]);
    }

    buttons.push([
      Markup.button.callback('◀️ К пробам', `back_samples:${sample.platformId}`),
    ]);

    const replyMarkup = Markup.inlineKeyboard(buttons);

    try {
      await ctx.editMessageText(text, {
        parse_mode: 'Markdown',
        ...replyMarkup,
      });
    } catch {
      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...replyMarkup,
      });
    }
  }

  /**
   * Показывает список характеристик для выбора
   */
  private async showDescriptionPicker(ctx: BotContext, sampleId: string) {
    const buttons: ReturnType<typeof Markup.button.callback>[][] = [];
    
    // По 2 кнопки в ряд
    for (let i = 0; i < SOIL_DESCRIPTIONS.length; i += 2) {
      const row: ReturnType<typeof Markup.button.callback>[] = [];
      row.push(Markup.button.callback(SOIL_DESCRIPTIONS[i], `set_desc:${sampleId}:${i}`));
      if (i + 1 < SOIL_DESCRIPTIONS.length) {
        row.push(Markup.button.callback(SOIL_DESCRIPTIONS[i + 1], `set_desc:${sampleId}:${i + 1}`));
      }
      buttons.push(row);
    }

    buttons.push([Markup.button.callback('◀️ Назад', `sample:${sampleId}`)]);

    await ctx.editMessageText(
      '📝 Выберите характеристику пробы:',
      Markup.inlineKeyboard(buttons),
    ).catch(() => {
      ctx.reply('📝 Выберите характеристику пробы:', Markup.inlineKeyboard(buttons));
    });
  }

  /**
   * Устанавливает характеристику пробы
   * Для площадок ПП — распространяется на все пробы площадки (химия, микробиология, паразитология)
   * Для СК и других — только на выбранную пробу
   */
  private async setDescription(ctx: BotContext, sampleId: string, descIndex: number) {
    const description = SOIL_DESCRIPTIONS[descIndex];
    if (!description) {
      await ctx.reply('❌ Неизвестная характеристика');
      return;
    }

    try {
      // Получаем пробу с информацией о площадке
      const sample = await this.prisma.sample.findUnique({
        where: { id: sampleId },
        include: {
          platform: true,
        },
      });

      if (!sample) {
        await ctx.reply('❌ Проба не найдена');
        return;
      }

      // Для ПП — обновляем все пробы площадки (включая микробиологию и паразитологию)
      if (sample.platform.type === 'PP') {
        await this.prisma.sample.updateMany({
          where: { platformId: sample.platformId },
          data: { description },
        });
        
        const count = await this.prisma.sample.count({
          where: { platformId: sample.platformId },
        });
        
        await ctx.reply(`✅ Характеристика "${description}" сохранена для всех ${count} проб площадки ${sample.platform.label}!`);
      } else {
        // Для СК и других — обновляем только выбранную пробу
        await this.prisma.sample.update({
          where: { id: sampleId },
          data: { description },
        });

        await ctx.reply(`✅ Характеристика "${description}" сохранена!`);
      }
      
      await this.showSampleDetails(ctx, sampleId);
    } catch (error) {
      this.logger.error('Ошибка сохранения характеристики:', error);
      await ctx.reply('❌ Ошибка сохранения');
    }
  }

  /**
   * Обновляет координаты для всех проб площадки
   * Также обновляет связанную площадку (ПП1 ↔ СК1)
   */
  private async updatePlatformCoordinates(
    platformId: string,
    latitude: string | null,
    longitude: string | null,
  ) {
    const updateData: { latitude?: string; longitude?: string } = {};
    
    if (latitude !== null) {
      updateData.latitude = latitude;
    }
    if (longitude !== null) {
      updateData.longitude = longitude;
    }

    if (Object.keys(updateData).length === 0) return;

    // Получаем информацию о текущей площадке
    const platform = await this.prisma.platform.findUnique({
      where: { id: platformId },
    });

    if (!platform) return;

    // Обновляем пробы текущей площадки
    await this.prisma.sample.updateMany({
      where: { platformId },
      data: updateData,
    });

    // Находим связанную площадку (ПП ↔ СК с тем же номером)
    // ПП1 и СК1 находятся в одном месте, поэтому координаты должны быть одинаковые
    let linkedType: 'PP' | 'SK' | null = null;
    if (platform.type === 'PP') {
      linkedType = 'SK';
    } else if (platform.type === 'SK') {
      linkedType = 'PP';
    }

    if (linkedType) {
      const linkedPlatform = await this.prisma.platform.findFirst({
        where: {
          projectId: platform.projectId,
          type: linkedType,
          number: platform.number,
        },
      });

      if (linkedPlatform) {
        // Обновляем координаты проб связанной площадки
        await this.prisma.sample.updateMany({
          where: { platformId: linkedPlatform.id },
          data: updateData,
        });
        
        this.logger.log(
          `Coordinates synced: ${platform.label} → ${linkedPlatform.label}`,
        );
      }
    }
  }

  /**
   * Отмечает пробу как отобранную
   * Для площадок ПП — отмечает все пробы площадки
   * Для СК и других — только выбранную пробу
   */
  private async collectSample(ctx: BotContext, sampleId: string) {
    try {
      // Сначала получаем пробу с информацией о площадке
      const sample = await this.prisma.sample.findUnique({
        where: { id: sampleId },
        include: {
          platform: true,
        },
      });

      if (!sample) {
        await ctx.reply('❌ Проба не найдена');
        return;
      }

      const now = new Date();

      // Для ПП — отмечаем все пробы площадки
      if (sample.platform.type === 'PP') {
        await this.prisma.sample.updateMany({
          where: { platformId: sample.platformId },
          data: {
            status: SampleStatus.COLLECTED,
            collectedAt: now,
          },
        });

        const count = await this.prisma.sample.count({
          where: { platformId: sample.platformId },
        });

        await ctx.reply(`✅ Все ${count} проб площадки ${sample.platform.label} отмечены как отобранные!`);
      } else {
        // Для СК и других — только выбранную пробу
        await this.prisma.sample.update({
          where: { id: sampleId },
          data: {
            status: SampleStatus.COLLECTED,
            collectedAt: now,
          },
        });

        await ctx.reply(`✅ Проба ${sample.cipher} отмечена как отобранная!`);
      }

      await this.showSampleDetails(ctx, sampleId);
    } catch (error) {
      this.logger.error('Ошибка отметки пробы:', error);
      await ctx.reply('❌ Ошибка. Попробуйте снова.');
    }
  }

  // ========== УТИЛИТЫ ==========

  /**
   * Обрабатывает документ с фото GPS-трекера через AI
   */
  private async handleGpsTrackerDocument(ctx: BotContext, platformId: string) {
    const document = (ctx.message as { document: { file_id: string; mime_type?: string } }).document;
    const mimeType = document.mime_type || '';
    
    if (!mimeType.startsWith('image/')) {
      await ctx.reply('❌ Пожалуйста, отправьте изображение');
      return;
    }

    try {
      await ctx.reply('🤖 Распознаю координаты с фото GPS-трекера...');

      // Получаем ссылку на файл
      const fileLink = await ctx.telegram.getFileLink(document.file_id);
      
      // Скачиваем и конвертируем в base64
      const response = await fetch(fileLink.href);
      const buffer = Buffer.from(await response.arrayBuffer());
      const base64 = buffer.toString('base64');

      this.logger.log(`Отправка документа GPS-трекера в AI, размер: ${buffer.length}`);

      // Распознаём координаты через AI
      const coords = await this.aiService.extractCoordinatesFromPhoto(base64);

      if (!coords) {
        await ctx.reply(
          '❌ Не удалось распознать координаты\n\n' +
          'Убедитесь что:\n' +
          '• На фото виден экран GPS-трекера\n' +
          '• Координаты чётко видны\n' +
          '• Фото не размытое',
        );
        return;
      }

      // Сохраняем координаты
      await this.updatePlatformCoordinates(platformId, coords.latitude, coords.longitude);
      if (ctx.session) {
        ctx.session.awaitingInput = undefined;
      }

      await ctx.reply(
        `✅ Координаты распознаны и сохранены!\n\n` +
        `📍 Широта: ${coords.latitude}\n` +
        `📍 Долгота: ${coords.longitude}\n` +
        `📊 Формат: ${coords.format}`,
      );
      await this.showPlatformMenu(ctx, platformId);
    } catch (error) {
      this.logger.error('Ошибка распознавания координат с GPS-трекера:', error);
      await ctx.reply('❌ Ошибка распознавания. Попробуйте снова.');
    }
  }

  // ============ ФОТОАЛЬБОМ ============

  /**
   * Показывает меню фотоальбома
   */
  private async showPhotosMenu(ctx: BotContext, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        _count: { select: { photos: true } },
      },
    });

    if (!project) {
      await ctx.reply('❌ Проект не найден');
      return;
    }

    const photosCount = project._count.photos;

    const text = 
      `📷 *Фотоальбом*\n` +
      `_${this.escapeMarkdown(project.name)}_\n\n` +
      `📸 Фотографий: ${photosCount}`;

    const buttons = [
      [Markup.button.callback('➕ Добавить фото', `upload_photos:${projectId}`)],
      [Markup.button.callback('◀️ К проекту', `project:${projectId}`)],
    ];

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons),
    }).catch(() => {
      ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons),
      });
    });
  }

  /**
   * Обрабатывает загрузку фото в фотоальбом
   */
  private async handlePhotoUpload(ctx: BotContext) {
    const session = ctx.session;
    if (!session?.selectedProjectId) {
      return;
    }

    const document = (ctx.message as { document: { file_id: string; file_name?: string; mime_type?: string } }).document;
    const mimeType = document.mime_type || '';
    const fileName = document.file_name || 'photo.jpg';

    // Проверяем формат
    const supportedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 
      'image/heic', 'image/heif', 'image/webp',
    ];
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp'];
    const extension = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
    
    const isSupported = supportedMimes.includes(mimeType.toLowerCase()) || 
                        supportedExtensions.includes(extension);

    if (!isSupported) {
      await ctx.reply(
        '⚠️ Пропускаю файл: неподдерживаемый формат\n' +
        'Поддерживаются: JPEG, PNG, HEIC, WebP',
      );
      return;
    }

    try {
      // Получаем ссылку на файл
      const fileLink = await ctx.telegram.getFileLink(document.file_id);
      
      // Скачиваем файл
      const response = await fetch(fileLink.href);
      const buffer = Buffer.from(await response.arrayBuffer());

      this.logger.log(`Загрузка фото: ${fileName}, size: ${buffer.length}`);

      // Загружаем через PhotosService
      const photo = await this.photosService.uploadPhoto(
        session.selectedProjectId,
        {
          buffer,
          originalname: fileName,
          mimetype: mimeType || 'image/jpeg',
        },
        session.userId,
      );

      // Увеличиваем счётчик и сохраняем ID последнего фото
      session.uploadedPhotosCount = (session.uploadedPhotosCount || 0) + 1;
      session.lastUploadedPhotoId = photo.id;

      // Формируем сообщение
      let msg = `✅ Фото #${session.uploadedPhotosCount} загружено`;
      if (photo.latitude && photo.longitude) {
        msg += `\n📍 GPS: ${photo.latitude}, ${photo.longitude}`;
      }
      if (photo.photoDate) {
        msg += `\n📅 ${new Date(photo.photoDate).toLocaleDateString('ru')}`;
      }
      msg += '\n\n🎤 _Отправьте голосовое для описания_';

      await ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (error) {
      this.logger.error('Ошибка загрузки фото:', error);
      await ctx.reply(`❌ Ошибка загрузки: ${fileName}`);
    }
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  }

  /**
   * Форматирует координату в десятичный формат (как на GPS-трекере)
   * Например: 55.85290, 036.98008
   */
  private formatCoordinate(decimal: number, isLongitude: boolean = false): string {
    // Для долготы добавляем ведущий ноль если меньше 100
    if (isLongitude) {
      return decimal.toFixed(5).padStart(9, '0');
    }
    return decimal.toFixed(5);
  }
}
