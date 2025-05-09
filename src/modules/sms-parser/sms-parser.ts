// src/modules/sms-parser/sms-parser.ts
import { extractSmsData } from './regex.js';
import { OrderProcessor } from '../../services/order-processor.js';
import { logger } from '../../utils/logger.js';
import type { ExtendedHotelOrderRequest } from '../../services/order-processor.js';

const orderProcessor = OrderProcessor.getInstance();

export async function processSmsOrder(text: string, senderPhone: string): Promise<void> {
    try {
        const data = extractSmsData(text);
        if (!data) {
            logger.warn('Необработанный формат SMS-сообщения:', { text });
            throw new Error('Неверный формат SMS. Пример: "Трансфер 12.08 14:00 из Аэропорт -> Гостиница +79161234567 минивэн"');
        }

        const orderData: ExtendedHotelOrderRequest = {
            rawAddresses: [data.from, data.to] as [string, string],
            client_id: `sms-${senderPhone}-${Date.now()}`,
            phone: data.phone,
            vehicleType: data.vehicleType,
            time: new Date(`${data.date} ${data.time}`),
            options: [],
            source: 'sms',
            rawData: text
        };

        await orderProcessor.processOrder(orderData);
    } catch (error) {
        logger.error('Сбой в обработке SMS-заказа:', error);
        throw error;
    }
}