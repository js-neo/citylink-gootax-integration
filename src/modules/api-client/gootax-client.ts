// src/modules/api-client/gootax-client.ts

import axios, { AxiosError } from 'axios';
import { GootaxRequestFormatter } from './gootax-formatter.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

export class GootaxClient {
    private readonly baseUrl = 'https://ca2.gootax.pro:8089';
    private readonly formatter = new GootaxRequestFormatter();
    private readonly maxRetries = 3;
    private readonly retryDelay = 1000;

    async createOrder(orderData: {
        pickup: { lat: number; lon: number; label: string };
        dropoff: { lat: number; lon: number; label: string };
        client_id: string;
        phone: string;
        tariff_id: string;
        time: Date;
        options: string[];
        comment?: string;
    }): Promise<{ order_id: string }> {
        let lastError: Error | undefined;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await this.tryCreateOrder(orderData);
            } catch (error) {
                const err = error as AxiosError<{ message?: string; error?: string }>;
                lastError = this.transformError(err);

                if (this.shouldRetry(err) && attempt < this.maxRetries) {
                    logger.warn(`Попытка повтора ${attempt}/${this.maxRetries}`, {
                        error: lastError.message
                    });
                    await this.delay(this.retryDelay * attempt);
                    continue;
                }
                throw lastError;
            }
        }

        throw lastError ?? new Error('Неизвестная ошибка в GootaxClient');
    }

    private async tryCreateOrder(orderData: Parameters<GootaxClient['createOrder']>[0]) {
        const payload = await this.formatter.createFullRequest(orderData);

        const formData = new URLSearchParams();
        for (const [key, value] of Object.entries(payload)) {
            formData.append(key, String(value));
        }

        const headers = {
            'appid': config.gootax.appId,
            'lang': 'ru',
            'tenantid': config.gootax.tenantId,
            'typeclient': 'dispatcher',
            'dispatcherid': config.gootax.dispatcherId || '',
            'Content-Type': 'application/x-www-form-urlencoded'
        };

        const response = await axios.post<{ order_id: string }>(
            `${this.baseUrl}/create_order`,
            formData.toString(),
            { headers, timeout: 10000 }
        );

        if (!response.data?.order_id) {
            throw new Error('Некорректный ответ от Gootax API: отсутствует order_id');
        }

        return response.data;
    }

    private shouldRetry(error: AxiosError): boolean {
        if (!error.response) return true;

        return error.response.status === 429 ||
            error.response.status >= 500 ||
            error.code === 'ECONNABORTED';
    }

    private transformError(error: AxiosError<{ message?: string; error?: string }>): Error {
        if (error.response) {
            const responseData = error.response.data || {};
            return new Error(
                `Ошибка Gootax API: ${
                    responseData.message ||
                    responseData.error ||
                    JSON.stringify(responseData)
                } (статус: ${error.response.status})`
            );
        }
        return new Error(error.message || 'Неизвестная ошибка Gootax API');
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}