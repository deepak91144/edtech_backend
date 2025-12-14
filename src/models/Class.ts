import mongoose, { Document, Schema } from 'mongoose';

export interface IClass extends Document {
    name: string;
    organizationId: mongoose.Types.ObjectId;
    teacherIds: mongoose.Types.ObjectId[];
    studentIds: mongoose.Types.ObjectId[];
    createdAt: Date;
}

const classSchema = new Schema<IClass>({
    name: {
        type: String,
        required: [true, 'Class name is required'],
        trim: true
    },
    organizationId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        required: [true, 'Organization ID is required']
    },
    teacherIds: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    studentIds: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for faster queries
classSchema.index({ organizationId: 1 });
classSchema.index({ teacherIds: 1 });
classSchema.index({ studentIds: 1 });

export default mongoose.model<IClass>('Class', classSchema);
