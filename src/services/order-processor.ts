import { HotelOrderRequest, GootaxOrderResponse } from '../dto/order.dto.js';
import { Geocoder } from '../modules/data-parser/geocoder.js';
import { OrderValidator } from '../modules/validation/index.js';
import { GootaxClient } from '../modules/api-client/index.js';
import { logger } from '../utils/logger.js';
import { createOrderQueue } from '../modules/api-client/queues.js';
import { sendOrderEmail } from '../modules/notifications/email.js';
import { SMSNotifier } from '../modules/notifications/sms.js';
import { TransferService, BookingService } from '../modules/crm-integration/index.js';
import { OperaTransfer } from '../modules/crm-integration/index.js';

export interface ExtendedHotelOrderRequest extends HotelOrderRequest {
    bookingId?: string;
    source?: string;
    rawData?: any;
}

type TransferOption = 'business_class' | 'child_seat';

export class OrderProcessor {
    private static instance: OrderProcessor;

    private readonly geocoder = new Geocoder();
    private readonly validator = new OrderValidator();
    private readonly gootaxClient = new GootaxClient();
    private readonly smsNotifier = new SMSNotifier();
    private readonly transferService: TransferService;
    private readonly bookingService: BookingService;

    private constructor() {
        if (!process.env.OPERA_API_URL || !process.env.OPERA_API_TOKEN) {
            logger.warn('CRM integration will be limited - Opera PMS credentials not configured');
        }

        this.transferService = new TransferService(
            process.env.OPERA_API_URL || '',
            process.env.OPERA_API_TOKEN || ''
        );
        this.bookingService = new BookingService(
            process.env.OPERA_API_URL || '',
            process.env.OPERA_API_TOKEN || ''
        );
    }

    static getInstance(): OrderProcessor {
        if (!OrderProcessor.instance) {
            OrderProcessor.instance = new OrderProcessor();
        }
        return OrderProcessor.instance;
    }

    async processOrder(orderData: ExtendedHotelOrderRequest): Promise<GootaxOrderResponse> {
        try {
            logger.info('Processing order', { orderId: orderData.client_id });

            const [pickup, dropoff] = await Promise.all([
                this.geocoder.geocode(orderData.rawAddresses[0]),
                this.geocoder.geocode(orderData.rawAddresses[1])
            ]);

            const validation = this.validator.validate({
                pickup,
                dropoff,
                time: orderData.time,
                phone: orderData.phone
            });

            if (!validation.isValid) {
                throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
            }

            const gootaxRequest = this.prepareGootaxRequest(orderData, pickup, dropoff);
            const result = await this.processViaQueue(gootaxRequest);

            if (orderData.bookingId) {
                await this.updateCrmStatus(orderData.bookingId, result.order_id)
                    .catch(error => logger.error('CRM update failed', { error }));
            }

            this.sendNotifications(orderData, result)
                .catch(error => logger.error('Notification failed', { error }));

            logger.info('Order processed successfully', { orderId: result.order_id });
            return result;
        } catch (error) {
            logger.error('Order processing failed', {
                error: error instanceof Error ? error.message : String(error),
                orderData
            });
            throw error;
        }
    }

    async processTransfer(transferId: string): Promise<GootaxOrderResponse> {
        try {
            logger.info('Processing transfer', { transferId });

            const transfer = await this.getTransferDetails(transferId);
            const orderData = this.prepareOrderFromTransfer(transfer);
            return this.processOrder(orderData);
        } catch (error) {
            logger.error('Transfer processing failed', {
                transferId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    async processSms(text: string, senderPhone: string): Promise<GootaxOrderResponse> {
        try {
            logger.info('Processing SMS order', { senderPhone });

            const orderData = this.parseSmsOrder(text, senderPhone);
            return this.processOrder(orderData);
        } catch (error) {
            logger.error('SMS order processing failed', {
                text,
                senderPhone,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private async getTransferDetails(transferId: string): Promise<OperaTransfer> {
        try {
            const today = new Date().toISOString().split('T')[0];
            const bookings = await this.transferService.getTransfersForDate(today);

            const transfer = bookings.find(t => t.id === transferId);
            if (!transfer) {
                throw new Error(`Transfer ${transferId} not found`);
            }
            return transfer;
        } catch (error) {
            logger.error('Failed to get transfer details', { transferId });
            throw error;
        }
    }

    private prepareOrderFromTransfer(transfer: OperaTransfer): ExtendedHotelOrderRequest {
        return {
            rawAddresses: [transfer.pickupAddress, transfer.dropoffAddress] as [string, string],
            client_id: `transfer-${transfer.id}`,
            phone: this.extractPhoneFromNotes(transfer.notes) || '',
            vehicleType: this.mapVehicleType(transfer.vehicleType),
            time: new Date(transfer.scheduledTime),
            bookingId: transfer.id,
            options: this.getTransferOptions(transfer),
            source: 'opera'
        };
    }

    private prepareGootaxRequest(
        orderData: ExtendedHotelOrderRequest,
        pickup: { lat: number; lon: number; address: string },
        dropoff: { lat: number; lon: number; address: string }
    ) {
        return {
            pickup: {
                lat: pickup.lat,
                lon: pickup.lon,
                label: pickup.address
            },
            dropoff: {
                lat: dropoff.lat,
                lon: dropoff.lon,
                label: dropoff.address
            },
            client_id: orderData.client_id,
            phone: this.normalizePhone(orderData.phone),
            tariff_id: this.getTariffId(orderData.vehicleType),
            time: orderData.time,
            options: orderData.options || [],
            comment: orderData.comment || '',
            metadata: {
                source: orderData.source || 'manual',
                booking_id: orderData.bookingId,
                original_data: orderData.rawData
            }
        };
    }

    private async processViaQueue(request: any): Promise<GootaxOrderResponse> {
        const job = await createOrderQueue.add({
            orderData: request,
            attempt: 1,
            timestamp: new Date().toISOString()
        });
        return job.finished();
    }

    private async updateCrmStatus(bookingId: string, orderId: string): Promise<void> {
        try {
            await this.transferService.createBookingTransfer(bookingId, {
                type: 'OTHER',
                pickupAddress: 'Updated by system',
                dropoffAddress: 'Updated by system',
                scheduledTime: new Date().toISOString(),
                vehicleType: 'STANDARD',
                notes: `Taxi order created: ${orderId} (${new Date().toLocaleString()})`
            });
            logger.info('CRM status updated', { bookingId, orderId });
        } catch (error) {
            logger.error('Failed to update CRM status', {
                bookingId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private async sendNotifications(
        orderData: ExtendedHotelOrderRequest,
        result: GootaxOrderResponse
    ): Promise<void> {
        try {
            await Promise.all([
                sendOrderEmail(orderData.client_id, {
                    orderId: result.order_id,
                    pickupAddress: orderData.rawAddresses[0],
                    dropoffAddress: orderData.rawAddresses[1],
                    time: orderData.time
                }),
                orderData.phone && this.smsNotifier.sendSMS(
                    orderData.phone,
                    `Ваш заказ #${result.order_id} принят. ` +
                    `Водитель: ${result.driver_info?.name || 'будет назначен'}`
                )
            ]);
            logger.info('Notifications sent', { orderId: result.order_id });
        } catch (error) {
            logger.error('Failed to send notifications', {
                orderId: result.order_id,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }

    private parseSmsOrder(text: string, senderPhone: string): ExtendedHotelOrderRequest {
        const phoneMatch = text.match(/(?:\+7|8)?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/);
        const addressMatch = text.split(/[->]/).map(s => s.trim()).filter(Boolean);
        const dateMatch = text.match(/(\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)\s+(\d{1,2}:\d{2})/);

        if (!addressMatch || addressMatch.length < 2) {
            throw new Error('Could not extract addresses from SMS');
        }

        return {
            rawAddresses: [addressMatch[0], addressMatch[1]] as [string, string],
            client_id: `sms-${Date.now()}`,
            phone: phoneMatch?.[0] ? this.normalizePhone(phoneMatch[0]) : senderPhone,
            vehicleType: text.toLowerCase().includes('минивэн') ? 'minivan' : 'sedan',
            time: dateMatch ? new Date(`${dateMatch[1]}.${new Date().getFullYear()} ${dateMatch[2]}`) : new Date(),
            options: [],
            source: 'sms',
            rawData: text
        };
    }

    private extractPhoneFromNotes(notes?: string): string | null {
        if (!notes) return null;
        const phoneMatch = notes.match(/(?:\+7|8)?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/);
        return phoneMatch?.[0] || null;
    }

    private mapVehicleType(crmType?: string): 'sedan' | 'minivan' {
        switch (crmType?.toUpperCase()) {
            case 'BUSINESS': return 'sedan';
            case 'MINIVAN': return 'minivan';
            default: return 'sedan';
        }
    }

    private getTransferOptions(transfer: OperaTransfer): TransferOption[] {
        const options: TransferOption[] = [];
        if (transfer.vehicleType === 'BUSINESS') {
            options.push('business_class');
        }
        if (transfer.notes?.includes('child')) {
            options.push('child_seat');
        }
        return options;
    }

    private normalizePhone(phone: string): string {
        return phone.replace(/\D/g, '').replace(/^8/, '7');
    }

    private getTariffId(vehicleType: 'sedan' | 'minivan'): string {
        switch (vehicleType) {
            case 'sedan': return process.env.GOOTAX_SEDAN_TARIFF || '39741';
            case 'minivan': return process.env.GOOTAX_MINIVAN_TARIFF || '39742';
            default: return process.env.GOOTAX_SEDAN_TARIFF || '39741';
        }
    }
}