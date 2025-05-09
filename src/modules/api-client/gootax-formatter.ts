// src/modules/api-client/gootax-formatter.ts

import { createHmac } from 'crypto';
import { config } from '../../config/index.js';

export interface GootaxOrderPayload {
    address: string;
    device_token: string;
    city_id: string;
    client_id: string;
    company_id: string;
    client_phone: string;
    tariff_id: string;
    order_time: string;
    pay_type: string;
    comment: string;
    current_time: string;
    type_request: string;
    additional_options: string;
    signature: string;
}

export class GootaxRequestFormatter {
    private readonly secret: string;

    constructor() {
        this.secret = config.gootax.secret;
    }

    formatAddress(
        pickup: { lat: number; lon: number; label: string },
        dropoff: { lat: number; lon: number; label: string }
    ): string {
        return JSON.stringify({
            address: [
                this.createAddressObject(pickup),
                this.createAddressObject(dropoff)
            ]
        }).replace(/"/g, '\\"');
    }

    private createAddressObject(location: {
        lat: number;
        lon: number;
        label: string;
    }) {
        return {
            city_id: "210861",
            city: "",
            label: location.label,
            street: "",
            house: "",
            housing: "",
            porch: "",
            apt: "",
            lat: location.lat.toFixed(6),
            lon: location.lon.toFixed(6),
            intercom: ""
        };
    }

    generateSignature(payload: Omit<GootaxOrderPayload, 'signature'>): string {
        const payloadString = JSON.stringify(payload);
        return createHmac('sha256', this.secret)
            .update(payloadString)
            .digest('hex');
    }

    formatDateTime(date: Date): string {
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
    }

    async createFullRequest(
        orderData: {
            pickup: { lat: number; lon: number; label: string };
            dropoff: { lat: number; lon: number; label: string };
            client_id: string;
            phone: string;
            tariff_id: string;
            time: Date;
            options: string[];
            comment?: string;
        }
    ): Promise<GootaxOrderPayload> {
        const basePayload = {
            address: this.formatAddress(orderData.pickup, orderData.dropoff),
            device_token: "citylink_auto",
            city_id: "210861",
            client_id: orderData.client_id,
            company_id: "12601",
            client_phone: orderData.phone,
            tariff_id: orderData.tariff_id,
            order_time: this.formatDateTime(orderData.time),
            pay_type: "CORP_BALANCE",
            comment: orderData.comment || "",
            current_time: Math.floor(Date.now() / 1000).toString(),
            type_request: "1",
            additional_options: JSON.stringify(orderData.options)
        };

        return {
            ...basePayload,
            signature: this.generateSignature(basePayload)
        };
    }
}
