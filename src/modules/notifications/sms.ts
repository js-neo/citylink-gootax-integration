// src/modules/notifications/sms.ts

import axios from 'axios';
import { logger } from '../../utils/logger.js';

export class SMSNotifier {
    private readonly SMS_GATEWAY_URL = 'https://smsprovider.com/api/send';

    async sendSMS(phone: string, message: string) {
        try {
            await axios.post(this.SMS_GATEWAY_URL, {
                phone,
                message,
                apiKey: process.env.SMS_API_KEY
            });
            logger.info(`SMS-сообщение отправлено на номер: ${phone}`);
        } catch (error) {
            logger.error('Не удалось отправить SMS-сообщение:', error);
        }
    }
}