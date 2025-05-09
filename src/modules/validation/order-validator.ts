// src/modules/validation/order-validator.ts

import { GeocodeResult } from '../data-parser/geocoder.js';
import { logger } from '../../utils/logger.js';
import { businessRules } from './rules.js';

export class OrderValidator {
    validate({
                 pickup,
                 dropoff,
                 time,
                 phone
             }: {
        pickup: GeocodeResult;
        dropoff: GeocodeResult;
        time: Date;
        phone: string;
    }) {
        const errors: string[] = [];
        const now = new Date();

        logger.info('Начата проверка заказа', { pickup, dropoff, time, phone });

        if (time < now) {
            const errorMsg = 'Время заказа не может быть в прошлом';
            logger.warn(errorMsg, { time, now });
            errors.push(errorMsg);
        }

        if (!/^7\d{10}$/.test(phone)) {
            const errorMsg = 'Неверный формат номера телефона';
            logger.warn(errorMsg, { phone });
            errors.push(errorMsg);
        }

        if (Math.abs(pickup.lat - dropoff.lat) < 0.001 &&
            Math.abs(pickup.lon - dropoff.lon) < 0.001) {
            const errorMsg = 'Точки отправления и назначения слишком близки';
            logger.warn(errorMsg, { pickup, dropoff });
            errors.push(errorMsg);
        }

        if (!businessRules.validateTimeSlot(time)) {
            const errorMsg = 'Время заказа выходит за допустимые рамки (05:00-23:00)';
            logger.warn(errorMsg, { time });
            errors.push(errorMsg);
        }

        if (errors.length > 0) {
            logger.error('Проверка заказа не пройдена', { errors });
        } else {
            logger.info('Проверка заказа успешно пройдена');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}