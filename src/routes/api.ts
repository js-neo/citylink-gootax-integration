// src/routes/api.ts

import express from 'express';
import {OrderProcessor} from '../services/order-processor.js';
import {logger} from '../utils/logger.js';
import {HotelOrderRequest} from '../dto/order.dto.js';

const router = express.Router();
const orderProcessor = OrderProcessor.getInstance();

function parseDate(dateString: string | undefined): Date {
    if (!dateString) return new Date();

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        throw new Error('Неверный формат даты. Используйте формат: ГГГГ-ММ-ДДЧЧ:мм:сс');
    }
    return date;
}

function getStatusCode(error: unknown): number {
    if (!(error instanceof Error)) return 500;

    const clientErrors = [
        'Необходимо',
        'Не указан',
        'Некорректный формат',
        'Неверный формат',
        'Отсутствует обязательное поле'
    ];

    return clientErrors.some(phrase => error.message.includes(phrase))
        ? 400
        : 500;
}

async function prepareOrderData(rawData: any): Promise<HotelOrderRequest> {
    try {
        logger.info('Обработка входящих данных', {input: rawData});

        if (!rawData.addresses || !Array.isArray(rawData.addresses) || rawData.addresses.length < 2) {
            throw new Error('Необходимо указать минимум 2 адреса: отправления и назначения');
        }

        if (!rawData.phone || !/^[\d+]{11,15}$/.test(rawData.phone)) {
            throw new Error('Неверный формат номера телефона');
        }

        const orderData: HotelOrderRequest = {
            rawAddresses: [rawData.addresses[0], rawData.addresses[1]] as [string, string],
            client_id: rawData.client_id || `manual-${Date.now()}`,
            phone: rawData.phone.replace(/[^\d+]/g, ''),
            vehicleType: rawData.vehicle_type === 'minivan' ? 'minivan' : 'sedan',
            time: parseDate(rawData.time),
            options: Array.isArray(rawData.options) ? rawData.options : [],
            comment: rawData.comment?.toString() || ''
        };

        logger.info('Данные успешно обработаны', {
            order: {
                ...orderData,
                time: orderData.time.toISOString()
            }
        });
        return orderData;
    } catch (error) {
        logger.error('Ошибка обработки данных', {
            error: error instanceof Error ? error.message : String(error),
            input: rawData
        });
        throw error;
    }
}

router.post('/orders', async (req, res) => {
    try {
        const parsedData = await prepareOrderData(req.body);
        const result = await orderProcessor.processOrder(parsedData);
        res.json({ success: true, ...result });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        res.status(500).json({
            success: false,
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
});

router.post('/opera-webhook', async (req, res) => {
    try {
        const orderData = req.body;

        if (!orderData.booking_id) {
            throw new Error('Отсутствует идентификатор бронирования');
        }

        const result = await orderProcessor.processTransfer(orderData.booking_id);

        res.status(200).json({
            success: true,
            order_id: result.order_id,
            status: result.status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        const statusCode = getStatusCode(error);
        const errorMessage = error instanceof Error ? error.message : 'Внутренняя ошибка сервера';
        logger.error('Ошибка обработки вебхука Opera', {error: errorMessage});

        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
});

router.get('/orders/:id', async (req, res) => {
    try {
        res.json({
            order_id: req.params.id,
            status: 'completed',
            updated_at: new Date().toISOString()
        });
    } catch (error) {
        const statusCode = getStatusCode(error);
        res.status(statusCode).json({
            error: 'Ошибка получения статуса заказа',
            timestamp: new Date().toISOString()
        });
    }
});

export default router;