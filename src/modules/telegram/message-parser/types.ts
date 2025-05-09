import { ExtendedHotelOrderRequest } from '../../../services/order-processor.js';

export interface TelegramParsedData {
    from: string;
    to: string;
    phone: string;
    datetime: string;
    vehicleType: 'sedan' | 'minivan';
    options?: string[];
}

export type TelegramOrderData = ExtendedHotelOrderRequest & {
    source: 'telegram';
    rawText: string;
};