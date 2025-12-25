import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const user = process.env.YANDEX_SMTP_USER;
    const pass = process.env.YANDEX_SMTP_PASSWORD;

    if (!user || !pass) {
      this.logger.warn(
        'Яндекс SMTP не настроен. Установите YANDEX_SMTP_USER и YANDEX_SMTP_PASSWORD в .env',
      );
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: 'smtp.yandex.ru',
      port: 465,
      secure: true, // SSL
      auth: {
        user,
        pass,
      },
    });

    this.logger.log(`Email сервис инициализирован для ${user}`);
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    if (!this.transporter) {
      return {
        success: false,
        error: 'Email сервис не настроен. Проверьте YANDEX_SMTP_USER и YANDEX_SMTP_PASSWORD',
      };
    }

    const fromEmail = process.env.YANDEX_SMTP_USER;
    const fromName = process.env.YANDEX_SMTP_FROM_NAME || 'ООО "ПОЛЕВЬЕ"';

    try {
      this.logger.log(`Отправка письма на ${options.to}...`);

      const result = await this.transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
      });

      this.logger.log(`Письмо отправлено: ${result.messageId}`);

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      this.logger.error(`Ошибка отправки письма: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Отправить запрос справки с PDF вложением
   */
  async sendInquiryRequest(params: {
    to: string;
    inquiryName: string;
    objectName: string;
    objectAddress: string;
    pdfBuffer: Buffer;
    pdfFileName: string;
  }): Promise<SendEmailResult> {
    const subject = 'Запрос справочной информации';

    const text = 'Добрый день! Во вложении запрос на предоставление справочной информации.';

    const html = '<p>Добрый день!</p><p>Во вложении запрос на предоставление справочной информации.</p>';

    return this.sendEmail({
      to: params.to,
      subject,
      text,
      html,
      attachments: [
        {
          filename: params.pdfFileName,
          content: params.pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  /**
   * Проверка работоспособности SMTP соединения
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log('SMTP соединение проверено успешно');
      return true;
    } catch (error) {
      this.logger.error(`Ошибка проверки SMTP: ${error.message}`);
      return false;
    }
  }
}

