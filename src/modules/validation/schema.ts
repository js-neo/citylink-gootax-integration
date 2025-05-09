// src/modules/validation/schema.ts
import { JSONSchemaType } from 'ajv';

export interface OrderData {
    pickup: {
        lat: number;
        lon: number;
    };
    dropoff: {
        lat: number;
        lon: number;
    };
    time: string;
    phone: string;
}

export const orderSchema: JSONSchemaType<OrderData> = {
    type: 'object',
    properties: {
        pickup: {
            type: 'object',
            properties: {
                lat: { type: 'number' },
                lon: { type: 'number' }
            },
            required: ['lat', 'lon'],
            additionalProperties: false
        },
        dropoff: {
            type: 'object',
            properties: {
                lat: { type: 'number' },
                lon: { type: 'number' }
            },
            required: ['lat', 'lon'],
            additionalProperties: false
        },
        time: {
            type: 'string',
            format: 'date-time'
        },
        phone: {
            type: 'string',
            pattern: '^7\\d{10}$'
        }
    },
    required: ['pickup', 'dropoff', 'time', 'phone'],
    additionalProperties: false
};