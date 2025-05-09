// src/modules/telegram/message-parser/index.ts

import { extractTelegramData } from './regex.js';
import { TelegramOrderData } from './types.js';
import { OrderProcessor } from '../../../services/order-processor.js';
import { logger } from '../../../utils/logger.js';
import { GootaxOrderResponse } from '../../../dto/order.dto.js';

export async function processTelegramOrder(text: string): Promise<GootaxOrderResponse> {
    try {
        const parsed = extractTelegramData(text);

        const orderData: TelegramOrderData = {
            rawAddresses: [parsed.from, parsed.to],
            client_id: `tg-${Date.now()}`,
            phone: parsed.phone,
            vehicleType: parsed.vehicleType,
            time: new Date(parsed.datetime),
            options: parsed.options || [],
            source: 'telegram',
            rawText: text
        };

        return await OrderProcessor.getInstance().processOrder(orderData);
    } catch (error) {
        logger.error('Не удалось выполнить синтаксический анализ заказа в Telegram:', error);
        throw new Error(
            error instanceof Error ? error.message :
                'Неверный формат сообщения. Пример:\n"Из аэропорта Шереметьево -> гостиница Космос, завтра 14:00, +79161234567, минивэн"'
        );
    }
}