import mongoose, { Schema, Document } from 'mongoose';

export interface IFeeStructure extends Document {
    organizationId: mongoose.Schema.Types.ObjectId;
    classIds: mongoose.Schema.Types.ObjectId[];
    academicYear: string;
    name: string;
    amount: number;
    dueDate: Date;
    type: 'ONE_TIME' | 'RECURRING';
    description?: string;
    isDeleted?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const feeStructureSchema: Schema = new Schema({
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    classIds: [{ type: Schema.Types.ObjectId, ref: 'Class', required: true }],
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    type: { type: String, enum: ['ONE_TIME', 'RECURRING'], default: 'ONE_TIME' },
    description: { type: String },
    isDeleted: { type: Boolean, default: false },
    academicYear: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model<IFeeStructure>('FeeStructure', feeStructureSchema);
