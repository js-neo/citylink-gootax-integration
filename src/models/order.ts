// src/models/order.ts

import { Sequelize, Model, DataTypes } from 'sequelize';
import { config } from '../config/index.js';

const sequelize = new Sequelize(config.redis.host, {
    dialect: 'postgres',
    logging: false
});

export class Order extends Model {
    public id!: number;
    public orderId!: string;
    public clientId!: string;
    public status!: 'pending' | 'completed' | 'failed';
    public details!: object;
}

Order.init({
    orderId: {
        type: DataTypes.STRING,
        unique: true
    },
    clientId: DataTypes.STRING,
    status: {
        type: DataTypes.ENUM('pending', 'completed', 'failed'),
        defaultValue: 'pending'
    },
    details: DataTypes.JSONB
}, {
    sequelize,
    tableName: 'orders'
});