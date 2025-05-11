// src/modules/api-client/queues.ts

import { GootaxClient } from './gootax-client.js';
import Bull from 'bull';
import { logger } from '../../utils/logger.js';
import type { RedisOptions } from 'ioredis';
import { EnhancedError } from '../../utils/error-wrapper.js';

interface OrderJobData {
    orderData: {
        pickup: { lat: number; lon: number; label: string };
        dropoff: { lat: number; lon: number; label: string };
        client_id: string;
        phone: string;
        tariff_id: string;
        time: string;
        options: string[];
        comment?: string;
    };
    attempt: number;
    timestamp: string;
    source: string;
    lastError?: {
        message: string;
        details?: Record<string, unknown>;
    };
}

export let createOrderQueue: Bull.Queue<OrderJobData>;

export const initOrderQueue = (redisOptions: RedisOptions) => {
    createOrderQueue = new Bull<OrderJobData>('gootax-orders', {
        redis: redisOptions,
        limiter: {
            max: 50,
            duration: 60 * 1000
        }
    });

    createOrderQueue.process(async (job) => {
        try {
            const orderData = {
                ...job.data.orderData,
                time: new Date(job.data.orderData.time)
            };
            const client = new GootaxClient();
            return await client.createOrder(orderData);
        } catch (error) {
            const enhancedError = EnhancedError.from(error);

            await job.update({
                ...job.data,
                lastError: {
                    message: enhancedError.message,
                    details: enhancedError.details
                }
            });

            throw new EnhancedError(`[Job ${job.id}] ${enhancedError.message}`, enhancedError.details);
        }
    });

    createOrderQueue.on('completed', (job, result) => {
        logger.info(`Заказ ${result.order_id} успешно обработан`, {
            jobId: job.id,
            status: result.status
        });
    });

    createOrderQueue.on('failed', (job, error) => {
        logger.error(`Job ${job.id} failed`, {
            error: error.message,
            details: job.data.lastError?.details
        });
    });
};

export const closeOrderQueue = async () => {
    if (createOrderQueue) {
        await createOrderQueue.close();
        logger.info('Очередь заказов корректно остановлена');
    }
};