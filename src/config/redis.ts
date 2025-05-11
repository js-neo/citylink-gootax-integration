// src/config/redis.ts

import { Redis, RedisOptions } from 'ioredis';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

let redisClient: Redis;
let isInitialized = false;

export const initRedis = async (): Promise<Redis> => {
    if (isInitialized) {
        return redisClient;
    }

    try {
        logger.info('Конфигурация Redis:', config.redis);

        if (!config.redis.host || !config.redis.port) {
            throw new Error('Отсутствует конфигурация Redis');
        }

        const redisOptions: RedisOptions = {
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db,
            retryStrategy: (times: number) => {
                const delay = Math.min(times * 100, 5000);
                logger.warn(`Повторное подключение к Redis через ${delay}мс`);
                return delay;
            },
            connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
            maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10)
        };

        if (process.env.REDIS_TLS === 'true') {
            redisOptions.tls = {};
        }

        redisClient = new Redis(redisOptions);

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
        logger.info('Redis успешно подключен');

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

export const getRedisOptionsForBull = (): RedisOptions => ({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    db: config.redis.db,
    ...(process.env.REDIS_TLS === 'true' ? { tls: {} } : {})
});

export const closeRedis = async (): Promise<void> => {
    if (redisClient) {
        try {
            await redisClient.quit();
            logger.info('Соединение с Redis успешно закрыто');
        } catch (error) {
            logger.error('Ошибка при закрытии соединения с Redis:', error);
        } finally {
            isInitialized = false;
        }
    }
};

export const isRedisInitialized = (): boolean =>
    isInitialized && redisClient?.status === 'ready';