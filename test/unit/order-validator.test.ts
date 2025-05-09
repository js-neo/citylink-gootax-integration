// test/unit/order-validator.test.ts

    import { OrderValidator } from '../../src/modules/validation/index.js';
import { expect } from 'chai';
import { GeocodeResult } from '../../src/modules/data-parser/index.js';

describe('OrderValidator', () => {
    const validator = new OrderValidator();
    const now = new Date();
    const futureDate = new Date(now.getTime() + 3600000);
    const pastDate = new Date(now.getTime() - 3600000);

    const validLocation = (index: number): GeocodeResult => ({
        lat: 55.75 + (index * 0.01),
        lon: 37.61 + (index * 0.01),
        address: `Location ${index}`
    });

    describe('validate()', () => {
        it('should validate correct order', () => {
            const result = validator.validate({
                pickup: validLocation(1),
                dropoff: validLocation(2),
                time: futureDate,
                phone: '79161234567'
            });

            expect(result.isValid).to.be.true;
            expect(result.errors).to.be.empty;
        });

        it('should reject past dates', () => {
            const result = validator.validate({
                pickup: validLocation(1),
                dropoff: validLocation(2),
                time: pastDate,
                phone: '79161234567'
            });

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Order time cannot be in the past');
        });

        it('should reject invalid phone numbers', () => {
            const result = validator.validate({
                pickup: validLocation(1),
                dropoff: validLocation(2),
                time: futureDate,
                phone: 'invalid'
            });

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Invalid phone number format');
        });

        it('should reject too close locations', () => {
            const location = validLocation(1);
            const result = validator.validate({
                pickup: location,
                dropoff: { ...location, lat: location.lat + 0.0001 },
                time: futureDate,
                phone: '79161234567'
            });

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Pickup and dropoff locations are too close');
        });

        it('should reject outside business hours', () => {
            const midnight = new Date(futureDate);
            midnight.setHours(3, 0, 0, 0);

            const result = validator.validate({
                pickup: validLocation(1),
                dropoff: validLocation(2),
                time: midnight,
                phone: '79161234567'
            });

            expect(result.isValid).to.be.false;
            expect(result.errors).to.include('Time slot is outside allowed hours (05:00-23:00)');
        });
    });
});