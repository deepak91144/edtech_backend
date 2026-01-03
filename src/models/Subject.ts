import mongoose, { Document, Schema } from 'mongoose';

export interface ISubject extends Document {
    name: string;
    description: string;
    classId?: mongoose.Types.ObjectId;
    teacherId?: mongoose.Types.ObjectId;
    createdAt: Date;
}

const subjectSchema = new Schema<ISubject>({
    name: {
        type: String,
        required: [true, 'Subject name is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Description is required']
    },
    classId: {
        type: Schema.Types.ObjectId,
        ref: 'Class',
        required: false
    },
    teacherId: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for faster queries
subjectSchema.index({ classId: 1 });

export default mongoose.model<ISubject>('Subject', subjectSchema);
