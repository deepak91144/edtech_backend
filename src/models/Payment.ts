import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
    studentFeeId: mongoose.Schema.Types.ObjectId;
    studentId: mongoose.Schema.Types.ObjectId;
    organizationId: mongoose.Schema.Types.ObjectId;
    amount: number;
    paymentMethod: 'CASH' | 'ONLINE' | 'CHEQUE' | 'BANK_TRANSFER';
    transactionId?: string; // For online/ref numbers
    date: Date;
    status: 'SUCCESS' | 'FAILED' | 'PENDING';
    remarks?: string;
    createdAt: Date;
    updatedAt: Date;
}

const paymentSchema: Schema = new Schema({
    studentFeeId: { type: Schema.Types.ObjectId, ref: 'StudentFee', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['CASH', 'ONLINE', 'CHEQUE', 'BANK_TRANSFER'], required: true },
    transactionId: { type: String },
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['SUCCESS', 'FAILED', 'PENDING'], default: 'SUCCESS' },
    remarks: { type: String }
}, { timestamps: true });

export default mongoose.model<IPayment>('Payment', paymentSchema);
