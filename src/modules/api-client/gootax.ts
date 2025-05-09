// src/modules/api-client/gootax.ts

import axios from 'axios';
import { createHmac } from 'crypto';

const GOOTAX_API_URL = 'https://ca2.gootax.pro:8089/create_order';

export const sendOrderToGootax = async (payload: object) => {
    const signature = createHmac('sha256', process.env.GOOTAX_SECRET!)
        .update(JSON.stringify(payload))
        .digest('hex');

    const response = await axios.post(GOOTAX_API_URL, payload, {
        headers: {
            appid: process.env.GOOTAX_APP_ID!,
            signature,
            tenantid: process.env.GOOTAX_TENANT_ID!,
        },
    });

    return response.data.order_id;
};