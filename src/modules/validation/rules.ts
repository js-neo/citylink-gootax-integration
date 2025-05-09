// src/modules/validation/rules.ts

import { GeocodeResult } from '../data-parser/geocoder.js';

export const businessRules = {
    validateTimeSlot: (time: Date) => time.getHours() >= 5 && time.getHours() <= 23,
    validateLocationDistance: (pickup: GeocodeResult, dropoff: GeocodeResult) =>
        Math.sqrt(
            Math.pow(pickup.lat - dropoff.lat, 2) +
            Math.pow(pickup.lon - dropoff.lon, 2)
        ) > 0.01
};