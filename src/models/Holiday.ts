
import mongoose, { Document, Schema } from 'mongoose';

export interface IHoliday extends Document {
    title: string;
    date: Date;
    description?: string;
    organizationId: mongoose.Types.ObjectId;
    academicYear?: string;
    createdAt: Date;
}

const HolidaySchema: Schema = new Schema({
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    description: { type: String, trim: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    academicYear: { type: String, required: false }, // Format: "YYYY-YYYY" e.g. "2024-2025"
    createdAt: { type: Date, default: Date.now }
});

// Compound index to prevent duplicate holidays with same name on same date for an org?
// Or just index on org and date for fast lookup
HolidaySchema.index({ organizationId: 1, date: 1 });

export default mongoose.model<IHoliday>('Holiday', HolidaySchema);
