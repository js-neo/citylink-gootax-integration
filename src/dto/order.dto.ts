// src/dto/order.dto.ts

export interface HotelOrderRequest {
    rawAddresses: [string, string];
    client_id: string;
    phone: string;
    vehicleType: 'sedan' | 'minivan';
    time: Date;
    options: string[];
    comment?: string;
}

export interface GootaxOrderResponse {
    order_id: string;
    status: 'created' | 'pending' | 'failed';
    driver_info?: {
        name: string;
        phone: string;
    };
}