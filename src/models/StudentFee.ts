import mongoose, { Schema, Document } from 'mongoose';

export interface IStudentFee extends Document {
    studentId: mongoose.Schema.Types.ObjectId;
    feeStructureId: mongoose.Schema.Types.ObjectId;
    organizationId: mongoose.Schema.Types.ObjectId;
    name: string; // Denormalized fee name
    amount: number; // Total amount to be paid (snapshot of FeeStructure amount)
    paidAmount: number;
    status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
    dueDate: Date;
    createdAt: Date;
    updatedAt: Date;
}

const studentFeeSchema: Schema = new Schema({
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    feeStructureId: { type: Schema.Types.ObjectId, ref: 'FeeStructure', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'], default: 'PENDING' },
    dueDate: { type: Date, required: true },
}, { timestamps: true });

export default mongoose.model<IStudentFee>('StudentFee', studentFeeSchema);
