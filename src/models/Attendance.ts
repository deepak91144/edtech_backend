import mongoose, { Schema, Document } from 'mongoose';

export interface IAttendance extends Document {
    classId: mongoose.Types.ObjectId;
    date: Date;
    records: {
        studentId: mongoose.Types.ObjectId;
        status: 'present' | 'absent' | 'notTaken';
    }[];
    takenBy: mongoose.Types.ObjectId;
    organizationId: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const AttendanceSchema: Schema = new Schema({
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    date: { type: Date, required: true },
    records: [{
        studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        status: { type: String, enum: ['present', 'absent', 'notTaken'], required: true }
    }],
    takenBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true }
}, {
    timestamps: true
});

// Compound index to ensure one attendance record per class per date
AttendanceSchema.index({ classId: 1, date: 1 }, { unique: true });

export default mongoose.model<IAttendance>('Attendance', AttendanceSchema);
