// src/modules/data-parser/geocoder.ts

import axios from 'axios';
import { getRedisClient } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';

export interface GeocodeResult {
    lat: number;
    lon: number;
    address: string;
}

export class Geocoder {
    private static CACHE_TTL = 86400;

    async geocode(address: string): Promise<GeocodeResult> {
        const redis = getRedisClient();
        const cached = await redis.get(`geo:${address}`);

        if (cached) {
            return JSON.parse(cached);
        }

        try {
            const response = await axios.get('https://geocode-maps.yandex.ru/1.x/', {
                params: {
                    geocode: address,
                    apikey: process.env.YANDEX_GEO_KEY,
                    format: 'json'
                }
            });

            const feature = response.data.response.GeoObjectCollection.featureMember[0];
            const [lon, lat] = feature.GeoObject.Point.pos.split(' ');

            const result = {
                lat: parseFloat(lat),
                lon: parseFloat(lon),
                address: feature.GeoObject.metaDataProperty.GeocoderMetaData.text
            };

            await redis.setex(`geo:${address}`, Geocoder.CACHE_TTL, JSON.stringify(result));
            return result;
        } catch (error) {
            logger.error('Не удалось выполнить геокодирование:', error);
            throw new Error('Ошибка геокодирования: сервис недоступен');
        }
    }
}