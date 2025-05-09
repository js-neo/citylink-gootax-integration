// src/app.ts

import express from 'express';
import { initRedis, getRedisClient, closeRedis, getRedisOptionsForBull } from './config/redis.js';
import { logger } from './utils/logger.js';
import { initEmailJobs } from './jobs/email-job.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', async (_req, res) => {
    try {
        const redisClient = getRedisClient();
        await redisClient.ping();

        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                redis: true,
                telegram: Boolean(process.env.TG_TOKEN),
                speechkit: Boolean(process.env.YANDEX_SPEECHKIT_KEY),
                sms: Boolean(process.env.SMS_API_KEY)
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Сервис недоступен'
        });
    }
});

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Необработанная ошибка:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

async function initializeDependencies() {
    const { default: apiRouter } = await import('./routes/api.js');
    const { initTelegramBot } = await import('./modules/telegram/index.js');
    const { SmsClient } = await import('./modules/sms-parser/index.js');

    app.use('/api', apiRouter);

    if (process.env.TG_TOKEN) {
        initTelegramBot();
        logger.info('Telegram бот инициализирован');
    }

    if (process.env.SMS_API_KEY) {
        const smsClient = new SmsClient();
        setInterval(() => smsClient.checkNewSms(), 300000);
        logger.info('SMS клиент инициализирован');
    }
}

async function initializeApp() {
    try {
        const redisClient = await initRedis();
        logger.info('Redis успешно подключен');

        const { initOrderQueue } = await import('./modules/api-client/queues.js');
        initOrderQueue(getRedisOptionsForBull());
        logger.info('Очередь заказов инициализирована');

        const { initCRMIntegrations } = await import('./modules/crm-integration/index.js');
        await initCRMIntegrations();
        logger.info('CRM интеграции инициализированы');

        initEmailJobs();
        logger.info('Email задачи инициализированы');

        await initializeDependencies();
        logger.info('Все зависимости инициализированы');

        const server = app.listen(PORT, () => {
            logger.info(`Сервер запущен на порту ${PORT}`);
            logger.info(`Окружение: ${process.env.NODE_ENV || 'development'}`);
        });

        const shutdown = async () => {
            logger.info('Грациозное завершение работы...');
            const { closeOrderQueue } = await import('./modules/api-client/queues.js');
            await closeOrderQueue();
            await closeRedis();
            server.close(() => {
                logger.info('HTTP сервер остановлен');
                process.exit(0);
            });
        };

        process.on('SIGTERM', shutdown);
        process.on('SIGINT', shutdown);

    } catch (error) {
        logger.error('Ошибка инициализации приложения:', {
            error: error instanceof Error ? error.message : 'Неизвестная ошибка',
            stack: error instanceof Error ? error.stack : undefined
        });
        await closeRedis();
        process.exit(1);
    }
}

initializeApp().catch((error) => {
    logger.error('Фатальная ошибка инициализации:', error);
    process.exit(1);
});