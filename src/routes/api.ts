// src/routes/api.ts
import express from 'express';
import { OrderProcessor } from '../services/order-processor.js';
import { logger } from '../utils/logger.js';
import { HotelOrderRequest } from '../dto/order.dto.js';

const router = express.Router();
const orderProcessor = OrderProcessor.getInstance();

async function parseManualInput(rawData: any): Promise<HotelOrderRequest> {
    try {
        logger.info('Parsing manual input', { rawData });

        if (!rawData.addresses || !Array.isArray(rawData.addresses) || rawData.addresses.length < 2) {
            throw new Error('Необходимо указать как минимум 2 адреса (откуда и куда)');
        }

        if (!rawData.phone) {
            throw new Error('Не указан номер телефона');
        }

        const orderData: HotelOrderRequest = {
            rawAddresses: [rawData.addresses[0], rawData.addresses[1]] as [string, string],
            client_id: rawData.client_id || `manual-${Date.now()}`,
            phone: rawData.phone,
            vehicleType: rawData.vehicle_type === 'minivan' ? 'minivan' : 'sedan',
            time: rawData.time ? new Date(rawData.time) : new Date(),
            options: rawData.options || [],
            comment: rawData.comment || ''
        };

        if (typeof rawData.time === 'string') {
            orderData.time = new Date(rawData.time);
            if (isNaN(orderData.time.getTime())) {
                throw new Error('Некорректный формат даты');
            }
        }

        logger.info('Manual input parsed successfully', { orderData });
        return orderData;
    } catch (error) {
        logger.error('Failed to parse manual input', {
            error: error instanceof Error ? error.message : String(error),
            rawData
        });
        throw error;
    }
}

router.post('/orders', async (req, res) => {
    try {
        const rawData = req.body;
        const parsedData = await parseManualInput(rawData);
        const result = await orderProcessor.processOrder(parsedData);

        res.json({
            success: true,
            order_id: result.order_id,
            status: result.status,
            driver_info: result.driver_info
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
        logger.error('Order processing failed', { error: errorMessage });

        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});

router.post('/opera-webhook', async (req, res) => {
    try {
        const orderData = req.body;

        if (!orderData.booking_id) {
            throw new Error('Отсутствует booking_id в данных запроса');
        }

        const result = await orderProcessor.processTransfer(orderData.booking_id);

        res.status(200).json({
            success: true,
            order_id: result.order_id,
            status: result.status
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        logger.error('Opera webhook processing failed', { error: errorMessage });

        res.status(500).json({
            success: false,
            error: errorMessage
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
        res.status(500).json({ error: 'Failed to get order status' });
    }
});

export default router;