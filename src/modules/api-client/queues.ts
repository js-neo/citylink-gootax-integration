// src/modules/api-client/queues.ts

import { GootaxClient } from './gootax-client.js';
import Bull from 'bull';
import { logger } from '../../utils/logger.js';
import type { RedisOptions } from 'ioredis';

interface OrderJobData {
    orderData: {
        pickup: { lat: number; lon: number; label: string };
        dropoff: { lat: number; lon: number; label: string };
        client_id: string;
        phone: string;
        tariff_id: string;
        time: Date;
        options: string[];
        comment?: string;
    };
    attempt: number;
    timestamp: string;
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
            logger.info(`Обработка задания заказа ${job.id}`);
            const client = new GootaxClient();
            return await client.createOrder(job.data.orderData);
        } catch (error) {
            logger.error('Ошибка обработки очереди:', {
                jobId: job.id,
                error: error instanceof Error ? error.message : error
            });
            throw error;
        }
    });

    createOrderQueue.on('completed', (job, result) => {
        logger.info(`Заказ ${result.order_id} успешно обработан`, {
            jobId: job.id,
            status: result.status
        });
    });

    createOrderQueue.on('failed', (job, error) => {
        logger.error(`Ошибка обработки заказа для задания ${job.id}:`, {
            error: error instanceof Error ? error.message : error,
            jobData: job.data
        });
    });
};

export const closeOrderQueue = async () => {
    if (createOrderQueue) {
        await createOrderQueue.close();
        logger.info('Очередь заказов корректно остановлена');
    }
};