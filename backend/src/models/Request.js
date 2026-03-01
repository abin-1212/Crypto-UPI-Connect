import mongoose from 'mongoose';

const RequestSchema = new mongoose.Schema({
    requestId: {
        type: String,
        unique: true,
        default: () => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },
    fromUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    toUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    toUPI: {
        type: String, // For requesting from non-users
    },
    toCryptoAddress: {
        type: String, // For crypto requests
    },
    amount: {
        type: Number,
        required: true,
        min: 1
    },
    currency: {
        type: String,
        enum: ['INR', 'USDC', 'DAI', 'ETH'],
        default: 'INR'
    },
    description: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['PENDING', 'PAID', 'DECLINED', 'EXPIRED'],
        default: 'PENDING'
    },
    paymentMethod: {
        type: String,
        enum: ['UPI', 'CONVERGEX_WALLET', 'METAMASK'],
        default: 'UPI'
    },
    expiresAt: {
        type: Date,
        default: () => new Date(+new Date() + 7 * 24 * 60 * 60 * 1000) // 7 days
    },
    paidAt: {
        type: Date
    },
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
    }
}, {
    timestamps: true
});

export default mongoose.model('Request', RequestSchema);
