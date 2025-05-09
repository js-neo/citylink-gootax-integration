// src/config/redis.ts

import { Redis } from 'ioredis';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

let redisClient: Redis;
let isInitialized = false;

export const initRedis = async (): Promise<Redis> => {
    if (isInitialized) {
        return redisClient;
    }

    try {
        if (!config.redis.host || !config.redis.port) {
            throw new Error('Отсутствует конфигурация Redis');
        }

        redisClient = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            retryStrategy: (times) => {
                const delay = Math.min(times * 100, 5000);
                logger.warn(`Повторное подключение к Redis через ${delay}мс`);
                return delay;
            },
            maxRetriesPerRequest: 3,
            connectTimeout: 10000
        });

        redisClient.on('connect', () => {
            isInitialized = true;
            logger.info('Подключение к Redis установлено');
        });

        redisClient.on('error', (err: Error) => {
            logger.error('Ошибка подключения к Redis:', err);
        });

        redisClient.on('ready', () => {
            logger.info('Redis готов принимать подключения');
        });

        redisClient.on('reconnecting', () => {
            logger.warn('Повторное подключение к Redis...');
        });

        redisClient.on('end', () => {
            isInitialized = false;
            logger.warn('Подключение к Redis закрыто');
        });

        await redisClient.ping();

        return redisClient;
    } catch (error) {
        logger.error('Ошибка инициализации Redis:', error);
        throw error;
    }
};

export const getRedisClient = (): Redis => {
    if (!isInitialized || !redisClient) {
        throw new Error('Redis клиент не инициализирован. Сначала вызовите initRedis()');
    }
    return redisClient;
};

export const closeRedis = async (): Promise<void> => {
    if (redisClient) {
        await redisClient.quit();
        isInitialized = false;
    }
};