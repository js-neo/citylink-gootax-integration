// src/modules/crm-integration/index.ts

import { logger } from "../../utils/logger.js";
import {
    fetchOperaBookings,
    fetchBookingDetails,
    fetchBookingTransfers,
    createTransfer,
    OperaBooking,
    OperaTransfer
} from './opera-pms.js';
import { fetchProtelBookings, ProtelBooking } from './protel.js';

export async function initCRMIntegrations() {
    try {

        if (process.env.OPERA_API_URL && process.env.OPERA_API_TOKEN) {
            logger.info('Инициализация интеграции с Opera PMS');

            const testBookings = await fetchOperaBookings(
                process.env.OPERA_API_URL,
                process.env.OPERA_API_TOKEN,
                { dateFrom: new Date().toISOString().split('T')[0] }
            );

            logger.info(`Получено ${testBookings.length} текущих бронирований из Opera PMS`);
        } else {
            logger.warn('Интеграция с Opera PMS отключена - отсутствуют настройки');
        }

        if (process.env.PROTEL_WSDL_URL) {
            logger.info('Инициализация интеграции с Protel');
            const testBookings = await fetchProtelBookings(process.env.PROTEL_WSDL_URL);
            logger.info(`Получено ${testBookings.length} бронирований из Protel`);
        } else {
            logger.warn('Интеграция с Protel отключена - отсутствует WSDL URL');
        }

        logger.info('Все CRM интеграции успешно инициализированы');
    } catch (error) {
        logger.error('Ошибка инициализации CRM интеграций:', error);
        throw error;
    }
}

export class TransferService {
    constructor(
        private operaApiUrl: string,
        private operaToken: string
    ) {}

    async getTransfersForDate(date: string): Promise<OperaTransfer[]> {
        const bookings = await fetchOperaBookings(
            this.operaApiUrl,
            this.operaToken,
            { dateFrom: date, dateTo: date, includeTransfers: true }
        );

        return bookings.flatMap(booking => booking.transfers || []);
    }

    async createBookingTransfer(
        bookingId: string,
        transferData: Omit<OperaTransfer, 'id' | 'status'>
    ): Promise<OperaTransfer> {
        return createTransfer(
            this.operaApiUrl,
            this.operaToken,
            bookingId,
            transferData
        );
    }
}

export class BookingService {
    constructor(
        private operaApiUrl: string,
        private operaToken: string
    ) {}

    async getBookingWithTransfers(bookingId: string): Promise<OperaBooking> {
        return fetchBookingDetails(
            this.operaApiUrl,
            this.operaToken,
            bookingId
        );
    }

    async getBookingTransfers(bookingId: string): Promise<OperaTransfer[]> {
        return fetchBookingTransfers(
            this.operaApiUrl,
            this.operaToken,
            bookingId
        );
    }
}

export * from './opera-pms.js';
export * from './protel.js';

export type { OperaBooking, OperaTransfer, ProtelBooking };