import mongoose, { Document, Schema } from 'mongoose';

export interface IPayroll extends Document {
    teacherId: mongoose.Types.ObjectId;
    organizationId: mongoose.Types.ObjectId;
    amount: number;
    month: string;
    status: 'Paid' | 'Pending' | 'Failed';
    paymentDate: Date;
    notes?: string;
}

const payrollSchema = new Schema<IPayroll>({
    teacherId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    organizationId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    month: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Paid', 'Pending', 'Failed'],
        default: 'Paid'
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

export default mongoose.model<IPayroll>('Payroll', payrollSchema);
