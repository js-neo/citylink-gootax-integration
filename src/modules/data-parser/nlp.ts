// src/modules/data-parser/nlp.ts

import axios from 'axios';
import { logger } from '../../utils/logger.js';
import { RegexPatterns } from './regex.js';

interface NLPResponse {
    addresses: string[];
    dates: string[];
}

interface YandexNLPResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

export class NLPParser {
    private readonly YANDEX_NLP_URL = 'https://llm.api.cloud.yandex.net/foundationModels/v1/completion';
    private readonly FALLBACK_REGEX = {
        ADDRESS: /(?:адрес|адресе|место|локация)[:\s]*(.+?)(?=\n|$)/gi,
        DATE: /(\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)\s+(\d{1,2}:\d{2})/g
    };

    async extractEntities(text: string): Promise<NLPResponse> {
        try {
            const response = await axios.post<YandexNLPResponse>(
                this.YANDEX_NLP_URL,
                {
                    model: "general",
                    messages: [{
                        role: "user",
                        content: `Извлеки адреса и даты в формате DD.MM.YYYY HH:mm из текста: "${text}". Ответ в JSON: {addresses: string[], dates: string[]}`
                    }]
                },
                {
                    headers: {
                        Authorization: `Api-Key ${process.env.YANDEX_NLP_KEY}`,
                        'x-folder-id': process.env.YANDEX_FOLDER_ID,
                        timeout: 5000
                    }
                }
            );

            const data = JSON.parse(response.data.choices[0].message.content) as {
                addresses?: string[];
                dates?: string[];
            };

            if (!data.addresses || data.addresses.length < 2) {
                throw new Error('Не удалось извлечь оба адреса');
            }

            return {
                addresses: data.addresses.slice(0, 2),
                dates: data.dates || []
            };
        } catch (error) {
            logger.error('Ошибка обработки NLP, используется резервный метод:', {
                error: error instanceof Error ? error.message : String(error),
                text
            });
            return this.fallbackParsing(text);
        }
    }

    private fallbackParsing(text: string): NLPResponse {
        const addresses: string[] = [];
        const dates: string[] = [];

        const addressMatches = text.matchAll(this.FALLBACK_REGEX.ADDRESS);
        for (const match of addressMatches) {
            if (match[1]) {
                addresses.push(match[1].trim());
            }
        }

        const dateMatches = text.matchAll(RegexPatterns.DATE_TIME);
        for (const match of dateMatches) {
            if (match[1] && match[2]) {
                dates.push(`${match[1]} ${match[2]}`);
            }
        }

        return {
            addresses: addresses.length >= 2 ?
                [addresses[0], addresses[1]] :
                ['Не указан', 'Не указан'],
            dates
        };
    }
}