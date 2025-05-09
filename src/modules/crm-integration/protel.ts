// src/modules/crm-integration/protel.ts
import soap from 'soap';
import { logger } from '../../utils/logger.js';

export interface ProtelBooking {
    bookingId: string;
    guestName: string;
    checkInDate: Date;
    transferDetails: {
        pickupAddress: string;
        dropoffAddress: string;
        time: Date;
    };
}

export const fetchProtelBookings = async (wsdlUrl: string): Promise<ProtelBooking[]> => {
    try {
        const client = await soap.createClientAsync(wsdlUrl);
        const response = await client.GetActiveBookingsAsync({});

        if (!response[0]?.bookings) {
            throw new Error('Некорректный формат ответа от Protel');
        }

        return response[0].bookings.map((b: any) => ({
            bookingId: b.bookingNumber,
            guestName: `${b.guestFirstName} ${b.guestLastName}`,
            checkInDate: new Date(b.checkInDate),
            transferDetails: {
                pickupAddress: b.pickupLocation,
                dropoffAddress: b.dropoffLocation,
                time: new Date(b.transferTime)
            }
        }));
    } catch (error) {
        logger.error('Ошибка интеграции с Protel:', {
            error: error instanceof Error ? error.message : String(error),
            url: wsdlUrl
        });
        throw new Error('Не удалось получить бронирования из Protel');
    }
};