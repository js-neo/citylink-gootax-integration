// src/modules/telegram/bot-core.ts
import { Telegraf, Markup } from 'telegraf';
import { VoiceProcessor } from './voice-processor.js';
import { logger } from '../../utils/logger.js';
import { OrderProcessor } from '../../services/order-processor.js';
import { getRedisClient } from '../../config/redis.js';
import { processTelegramOrder } from './message-parser/index.js';
import type { ParsedOrder } from './voice-processor.js';

export class TelegramBot {
    private readonly bot: Telegraf;
    private readonly voiceProcessor: VoiceProcessor;
    private readonly orderProcessor: OrderProcessor;
    private readonly redis = getRedisClient();

    constructor() {
        if (!process.env.TG_TOKEN) {
            throw new Error('Токен Telegram не настроен');
        }

        this.bot = new Telegraf(process.env.TG_TOKEN);
        this.voiceProcessor = new VoiceProcessor();
        this.orderProcessor = OrderProcessor.getInstance();
        this.setupHandlers();
    }

    private setupHandlers(): void {
        this.bot.use(async (ctx, next) => {
            if (!ctx.message) return next();

            if ('voice' in ctx.message) {
                try {
                    const chatId = ctx.message.chat.id;

                    const lastRequest = await this.redis.get(`tg_rate_limit:${chatId}`);
                    if (lastRequest && Date.now() - parseInt(lastRequest) < 5000) {
                        await ctx.reply('⚠️ Слишком частые запросы. Попробуйте через 5 секунд');
                        return;
                    }

                    await this.redis.set(`tg_rate_limit:${chatId}`, Date.now().toString(), 'EX', 5);
                    await ctx.sendChatAction('typing');
                    const message = await ctx.reply('⏳ Обрабатываю голосовое сообщение...');

                    const fileId = ctx.message.voice.file_id;
                    const parsedOrder = await this.voiceProcessor.processVoiceMessage(fileId);
                    const orderText = JSON.stringify(parsedOrder);

                    await this.redis.set(
                        `tg_voice:${ctx.message.message_id}`,
                        orderText,
                        'EX',
                        86400
                    );

                    await ctx.telegram.editMessageText(
                        chatId,
                        message.message_id,
                        undefined,
                        `🔍 Распознанный текст:\n\n"${parsedOrder.text}"\n\nПроверьте правильность и подтвердите заказ:`,
                        {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: '✅ Подтвердить', callback_data: `confirm_${ctx.message.message_id}` },
                                        { text: '❌ Отменить', callback_data: `cancel_${ctx.message.message_id}` }
                                    ]
                                ]
                            }
                        }
                    );
                } catch (error) {
                    logger.error('Ошибка голосового сообщения:', error);
                    await ctx.reply('❌ Не удалось обработать голосовое сообщение');
                }
                return;
            }

            if ('text' in ctx.message) {
                if (ctx.message.text.includes('🎤')) {
                    await ctx.reply('Просто отправьте голосовое сообщение с деталями заказа');
                    return;
                }

                try {
                    await ctx.sendChatAction('typing');
                    const orderData = await processTelegramOrder(ctx.message.text);
                    await ctx.reply(`✅ Заказ #${orderData.order_id} создан!`);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
                    await ctx.reply(`❌ Ошибка: ${errorMessage}\nПопробуйте отправить голосовое сообщение или /help`);
                }
                return;
            }

            return next();
        });

        this.bot.action(/^confirm_(\d+)$/, async (ctx) => {
            const messageId = ctx.match[1];
            const orderText = await this.redis.get(`tg_voice:${messageId}`);

            if (!orderText) {
                await ctx.answerCbQuery('Сообщение устарело');
                return;
            }

            try {
                const parsedOrder: ParsedOrder = JSON.parse(orderText);
                if (ctx.update.callback_query.message) {
                    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
                }
                await ctx.answerCbQuery('Обрабатываю заказ...');

                const orderData = await this.orderProcessor.processOrder({
                    rawAddresses: [parsedOrder.pickup, parsedOrder.dropoff],
                    client_id: `tg-${messageId}-${Date.now()}`,
                    phone: parsedOrder.phone,
                    vehicleType: parsedOrder.vehicleType,
                    time: parsedOrder.time,
                    options: [],
                    source: 'telegram'
                });

                await ctx.reply(`✅ Заказ #${orderData.order_id} успешно создан!`);
                await ctx.reply('Что дальше?', Markup.keyboard([
                    ['🚗 Проверить статус', '📞 Связаться с водителем'],
                    ['🆘 Поддержка']
                ]).resize());
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
                await ctx.reply(`❌ Ошибка: ${errorMessage}\nПопробуйте отправить заказ снова.`);
            }
        });

        this.bot.command('start', async (ctx) => {
            await ctx.reply(
                `👋 Добро пожаловать в бот заказов трансферов!\n\n` +
                `<b>Как сделать заказ:</b>\n` +
                `1. Отправьте голосовое сообщение с деталями\n` +
                `2. Проверьте распознанный текст\n` +
                `3. Подтвердите заказ\n\n` +
                `Пример: "Заказ на завтра в 14:00 из аэропорта Шереметьево в гостиницу Космос, минивэн, телефон 89161234567"`,
                {
                    parse_mode: 'HTML',
                    ...Markup.keyboard([
                        ['🎤 Отправить голосовой заказ'],
                        ['ℹ️ Помощь']
                    ]).resize()
                }
            );
        });

        this.bot.catch((error) => {
            logger.error('Bot error:', error);
        });
    }

    public start(): void {
        const launchConfig = process.env.NODE_ENV === 'production' ? {
            webhook: {
                domain: process.env.WEBHOOK_DOMAIN!,
                port: parseInt(process.env.PORT || '3000'),
                hookPath: '/telegram-webhook'
            }
        } : {};

        this.bot.launch(launchConfig).then(() => {
            logger.info(process.env.NODE_ENV === 'production'
                ? `Бот webhook запущен на ${process.env.WEBHOOK_DOMAIN}`
                : 'Запущен бот-опрос');
        });
    }
}