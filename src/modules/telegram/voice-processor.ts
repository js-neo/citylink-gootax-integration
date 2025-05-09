// src/modules/telegram/voice-processor.ts

import axios from 'axios';
import { logger } from '../../utils/logger.js';
import { TelegramVoiceLoader } from './voice-loader.js';

export interface ParsedOrder {
    text: string;
    time: Date;
    pickup: string;
    dropoff: string;
    phone: string;
    vehicleType: 'sedan' | 'minivan';
}

export class VoiceProcessor {
    private readonly loader = new TelegramVoiceLoader();

    async processVoiceMessage(fileId: string): Promise<ParsedOrder> {
        try {
            const oggBuffer = await this.loader.downloadVoiceMessage(fileId);
            const audioBuffer = await this.loader.convertToWav(oggBuffer);
            const text = await this.transcribeWithSpeechKit(audioBuffer);

            return this.parseOrderText(text);
        } catch (error) {
            logger.error('Ошибка обработки голосового сообщения:', error);
            throw new Error('Ошибка обработки голосового сообщения');
        }
    }

    private async transcribeWithSpeechKit(buffer: Buffer): Promise<string> {
        const response = await axios.post(
            'https://stt.api.cloud.yandex.net/speech/v1/stt:recognize',
            buffer,
            {
                headers: {
                    'Authorization': `Api-Key ${process.env.YANDEX_SPEECHKIT_KEY}`,
                    'Content-Type': 'audio/ogg'
                },
                timeout: 10000
            }
        );

        if (!response.data.result) {
            throw new Error('Пустой результат транскрипции');
        }

        return response.data.result;
    }

    private parseOrderText(text: string): ParsedOrder {
        const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();

        const time = this.parseDate(normalizedText);

        const addressParts = normalizedText.split(/из|в|телефон/i);
        const pickup = this.extractValue(addressParts, 1, 'адрес отправления');
        const dropoff = this.extractValue(addressParts, 2, 'адрес назначения');

        const phone = this.extractPhone(normalizedText);

        return {
            text: text,
            time,
            pickup,
            dropoff,
            phone,
            vehicleType: normalizedText.includes('минивэн') ? 'minivan' : 'sedan'
        };
    }

    private extractValue(parts: string[], index: number, fieldName: string): string {
        const value = parts[index]?.trim().replace(/[^а-яё0-9\s.,-]/gi, '');
        if (!value) throw new Error(`Не указан ${fieldName}`);
        return value;
    }

    private extractPhone(text: string): string {
        const phoneMatch = text.match(/(?:\+7|8)[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/);
        if (!phoneMatch) throw new Error('Не найден номер телефона');
        return phoneMatch[0].replace(/\D/g, '').replace(/^8/, '7');
    }

    private parseDate(text: string): Date {
        const now = new Date();
        const currentYear = now.getFullYear();

        const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
        if (!timeMatch) {
            throw new Error('Не удалось распознать время');
        }
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);

        if (text.includes('завтра') || text.includes('завтрак')) {
            const date = new Date(now);
            date.setDate(date.getDate() + 1);
            date.setHours(hours, minutes, 0, 0);
            return date;
        }

        if (text.includes('послезавтра')) {
            const date = new Date(now);
            date.setDate(date.getDate() + 2);
            date.setHours(hours, minutes, 0, 0);
            return date;
        }

        const weekDays = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
        for (let i = 0; i < weekDays.length; i++) {
            if (text.includes(weekDays[i])) {
                const date = new Date(now);
                const currentDay = date.getDay() === 0 ? 6 : date.getDay() - 1;
                let daysToAdd = (i - currentDay + 7) % 7;
                if (daysToAdd === 0 && date.getHours() >= hours && date.getMinutes() > minutes) {
                    daysToAdd = 7;
                }
                date.setDate(date.getDate() + daysToAdd);
                date.setHours(hours, minutes, 0, 0);
                return date;
            }
        }

        const dateMatch = text.match(/(\d{1,2})[\.\/](\d{1,2})(?:[\.\/](\d{2,4}))?/);
        if (dateMatch) {
            const day = parseInt(dateMatch[1]);
            const month = parseInt(dateMatch[2]) - 1;

            let year = currentYear;
            if (dateMatch[3]) {
                year = parseInt(dateMatch[3]);
                if (year < 100) {
                    year = year + 2000;
                }
            }

            const date = new Date(year, month, day, hours, minutes);
            if (isNaN(date.getTime())) {
                throw new Error('Некорректная дата');
            }

            if (!dateMatch[3] && date < now) {
                date.setFullYear(year + 1);
            }

            return date;
        }

        const date = new Date(now);
        date.setHours(hours, minutes, 0, 0);

        if (date < now) {
            date.setDate(date.getDate() + 1);
        }

        return date;
    }
}