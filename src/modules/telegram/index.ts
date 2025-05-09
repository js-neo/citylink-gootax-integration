// src/modules/telegram/index.ts

import { TelegramBot } from './bot-core.js';
import { logger } from '../../utils/logger.js';

let botInstance: TelegramBot;

export const initTelegramBot = () => {
    if (!process.env.TG_TOKEN) {
        logger.warn('Токен Telegram не настроен - бот отключен');
        return;
    }

    botInstance = new TelegramBot();
    botInstance.start();
};

export const getTelegramBot = (): TelegramBot => {
    if (!botInstance) throw new Error('Telegram-бот не инициализирован');
    return botInstance;
};