// src/modules/sms-parser/sms-client.ts
import axios from 'axios';
import { logger } from '../../utils/logger.js';
import { processSmsOrder } from './sms-parser.js';

export class SmsClient {
    private readonly API_URL = 'https://sms-gateway.example.com/api';

    async checkNewSms() {
        try {
            const response = await axios.get(`${this.API_URL}/incoming`, {
                params: {
                    apiKey: process.env.SMS_API_KEY,
                    limit: 10
                }
            });

            for (const sms of response.data.messages) {
                await processSmsOrder(sms.text, sms.phone);
            }
        } catch (error) {
            logger.error('Не удалось проверить SMS-сообщение:', error);
        }
    }
}