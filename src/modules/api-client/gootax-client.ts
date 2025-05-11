// src/modules/api-client/gootax-client.ts

import axios, { AxiosError } from 'axios';
import { GootaxRequestFormatter } from './gootax-formatter.js';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { EnhancedError } from '../../utils/error-wrapper.js';

export interface GootaxOrderResponse {
    order_id: string;
    status?: string;
    driver_info?: {
        name?: string;
        phone?: string;
        car_number?: string;
    };
}

interface GootaxErrorResponse {
    error?: string;
    message?: string;
    status?: string;
    [key: string]: unknown;
}

export class GootaxClient {
    private readonly baseUrl = 'https://ca2.gootax.pro:8089';
    private readonly formatter = new GootaxRequestFormatter();
    private readonly maxRetries = 3;
    private readonly retryDelay = 1000;

    private isSuccessResponse(data: any): data is GootaxOrderResponse {
        return typeof data?.order_id === 'string';
    }

    async createOrder(orderData: {
        pickup: { lat: number; lon: number; label: string };
        dropoff: { lat: number; lon: number; label: string };
        client_id: string;
        phone: string;
        tariff_id: string;
        time: Date;
        options: string[];
        comment?: string;
    }): Promise<GootaxOrderResponse> {
        let lastError: EnhancedError | undefined;
        let lastPayload = '';
        let lastHeaders: Record<string, string> = {};

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const { payload, headers } = await this.prepareRequestData(orderData);
                lastPayload = payload;
                lastHeaders = headers;

                const response = await this.tryCreateOrder(payload, headers);
                logger.debug('Ответ от Gootax API:', { response });
                return response;
            } catch (error) {
                lastError = this.handleRequestError(
                    error as AxiosError<GootaxErrorResponse>,
                    lastPayload,
                    lastHeaders,
                    attempt
                );

                if (lastError.details?.isRetryable && attempt < this.maxRetries) {
                    await this.delay(this.retryDelay * attempt);
                    continue;
                }
                throw lastError;
            }
        }
        throw lastError ?? new EnhancedError('Неизвестная ошибка в GootaxClient');
    }

    private async prepareRequestData(orderData: {
        pickup: { lat: number; lon: number; label: string };
        dropoff: { lat: number; lon: number; label: string };
        client_id: string;
        phone: string;
        tariff_id: string;
        time: Date;
        options: string[];
        comment?: string;
    }): Promise<{
        payload: string;
        headers: Record<string, string>;
    }> {
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

        return { payload: formData.toString(), headers };
    }

    private async tryCreateOrder(
        payload: string,
        headers: Record<string, string>
    ): Promise<GootaxOrderResponse> {
        const response = await axios.post<GootaxOrderResponse | GootaxErrorResponse>(
            `${this.baseUrl}/create_order`,
            payload,
            {
                headers,
                timeout: 10000,
                transformResponse: [this.parseGootaxResponse.bind(this)]
            }
        );

        if (!this.isSuccessResponse(response.data)) {
            throw new EnhancedError('Некорректный ответ от Gootax API', {
                responseData: response.data,
                curlCommand: this.generateCurlCommand(payload, headers)
            });
        }

        return response.data;
    }

    private parseGootaxResponse(data: string): GootaxOrderResponse {
        try {
            const parsed = JSON.parse(data) as GootaxOrderResponse | { id: string };

            if ('order_id' in parsed) {
                return parsed;
            }
            if ('id' in parsed) {
                return { order_id: parsed.id, ...parsed };
            }

            throw new EnhancedError(`Неожиданный формат ответа: ${data}`, {
                rawData: data
            });
        } catch (e) {
            throw new EnhancedError('Не удалось разобрать ответ от Gootax API', {
                rawData: data,
                parseError: e instanceof Error ? e.message : String(e)
            });
        }
    }

    private handleRequestError(
        error: AxiosError<GootaxErrorResponse>,
        payload: string,
        headers: Record<string, string>,
        attempt: number
    ): EnhancedError {
        const curlCommand = this.generateCurlCommand(payload, headers);
        const status = error.response?.status || 'нет ответа';
        const responseData = error.response?.data;

        const errorMessage = [
            `Ошибка ${status}: ${responseData?.message || responseData?.error || error.message}`,
            `CURL для повтора: ${curlCommand}`,
            responseData ? `Ответ API: ${JSON.stringify(responseData)}` : 'Нет данных в ответе'
        ].join('\n\n');

        const enhancedError = new EnhancedError(errorMessage, {
            curlCommand,
            statusCode: error.response?.status,
            isRetryable: this.shouldRetry(error),
            responseData,
            attempt
        });

        if (this.shouldRetry(error) && attempt < this.maxRetries) {
            logger.warn(`Попытка повтора ${attempt}/${this.maxRetries}`, {
                error: enhancedError.message,
                ...enhancedError.details
            });
        }

        return enhancedError;
    }

    private generateCurlCommand(payload: string, headers: Record<string, string>): string {
        const curlHeaders = Object.entries(headers)
            .map(([key, value]) => `--header '${key}: ${value}'`)
            .join(' \\\n');

        const formData = new URLSearchParams(payload);
        const curlForm = Array.from(formData.entries())
            .map(([key, value]) => `--form '${key}=${value.replace(/'/g, "'\\''")}'`)
            .join(' \\\n');

        return `curl --location '${this.baseUrl}/create_order' \\\n${curlHeaders} \\\n${curlForm}`;
    }

    private shouldRetry(error: AxiosError): boolean {
        if (!error.response) return true;
        return error.response.status === 429 ||
            error.response.status >= 500 ||
            error.code === 'ECONNABORTED';
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}