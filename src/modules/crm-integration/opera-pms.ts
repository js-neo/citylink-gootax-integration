// src/modules/crm-integration/opera-pms.ts
import axios from 'axios';
import { logger } from "../../utils/logger.js";

export interface OperaBooking {
    id: string;
    guestName: string;
    checkInDate: string;
    checkOutDate: string;
    roomNumber: string;
    status: string;
    transfers?: OperaTransfer[];
}

export interface OperaTransfer {
    id: string;
    type: 'ARRIVAL' | 'DEPARTURE' | 'OTHER';
    pickupAddress: string;
    dropoffAddress: string;
    scheduledTime: string;
    vehicleType: string;
    status: string;
    notes?: string;
}

const OPERA_API_TIMEOUT = 10000;

export const fetchOperaBookings = async (
    apiUrl: string,
    token: string,
    params?: {
        dateFrom?: string;
        dateTo?: string;
        includeTransfers?: boolean;
    }
): Promise<OperaBooking[]> => {
    try {
        const response = await axios.get(`${apiUrl}/bookings`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Accept': 'application/json'
            },
            params: {
                dateFrom: params?.dateFrom || new Date().toISOString().split('T')[0],
                dateTo: params?.dateTo,
                expand: params?.includeTransfers ? 'transfers' : undefined
            },
            timeout: OPERA_API_TIMEOUT
        });

        if (!response.data?.bookings) {
            throw new Error('Некорректный формат ответа от Opera PMS');
        }

        return response.data.bookings;
    } catch (error) {
        logger.error('Ошибка получения бронирований из Opera PMS:', {
            error: error instanceof Error ? error.message : String(error),
            url: `${apiUrl}/bookings`,
            params
        });
        throw new Error('Не удалось получить бронирования из Opera PMS');
    }
};

export const fetchBookingDetails = async (
    apiUrl: string,
    token: string,
    bookingId: string
): Promise<OperaBooking> => {
    try {
        const response = await axios.get(`${apiUrl}/bookings/${bookingId}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Accept': 'application/json'
            },
            params: {
                expand: 'transfers'
            },
            timeout: OPERA_API_TIMEOUT
        });

        if (!response.data) {
            throw new Error('Бронирование не найдено');
        }

        return response.data;
    } catch (error) {
        logger.error('Ошибка получения деталей бронирования:', {
            error: error instanceof Error ? error.message : String(error),
            bookingId,
            url: `${apiUrl}/bookings/${bookingId}`
        });
        throw new Error(`Не удалось получить данные бронирования ${bookingId}`);
    }
};

export const fetchBookingTransfers = async (
    apiUrl: string,
    token: string,
    bookingId: string
): Promise<OperaTransfer[]> => {
    try {
        const response = await axios.get(`${apiUrl}/bookings/${bookingId}/transfers`, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Accept': 'application/json'
            },
            timeout: OPERA_API_TIMEOUT
        });

        return response.data?.transfers || [];
    } catch (error) {
        logger.error('Ошибка получения трансферов:', {
            error: error instanceof Error ? error.message : String(error),
            bookingId,
            url: `${apiUrl}/bookings/${bookingId}/transfers`
        });
        throw new Error(`Не удалось получить трансферы для бронирования ${bookingId}`);
    }
};

export const createTransfer = async (
    apiUrl: string,
    token: string,
    bookingId: string,
    transferData: Omit<OperaTransfer, 'id' | 'status'>
): Promise<OperaTransfer> => {
    try {
        const response = await axios.post(
            `${apiUrl}/bookings/${bookingId}/transfers`,
            transferData,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                timeout: OPERA_API_TIMEOUT
            }
        );

        return response.data;
    } catch (error) {
        logger.error('Ошибка создания трансфера:', {
            error: error instanceof Error ? error.message : String(error),
            bookingId,
            transferData,
            url: `${apiUrl}/bookings/${bookingId}/transfers`
        });
        throw new Error('Не удалось создать трансфер');
    }
};