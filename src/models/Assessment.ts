import mongoose, { Document, Schema } from 'mongoose';

export interface IQuestion {
    type: 'multiple_choice' | 'single_choice' | 'true_false' | 'descriptive';
    text: string;
    options?: string[];
    correctAnswer?: string | string[];
    points: number;
}

export interface IAssessment extends Document {
    title: string;
    description?: string;
    classId: mongoose.Types.ObjectId;
    teacherId: mongoose.Types.ObjectId;
    questions: IQuestion[];
    status: 'draft' | 'published';
    dueDate?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const AssessmentSchema: Schema = new Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    questions: [{
        type: {
            type: String,
            enum: ['multiple_choice', 'single_choice', 'true_false', 'descriptive'],
            required: true
        },
        text: { type: String, required: true },
        options: [{ type: String }],
        correctAnswer: { type: Schema.Types.Mixed }, // String or Array of Strings
        points: { type: Number, required: true, min: 0 }
    }],
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'draft'
    },
    dueDate: { type: Date }
}, {
    timestamps: true
});

// Indexes
AssessmentSchema.index({ classId: 1, status: 1 });
AssessmentSchema.index({ teacherId: 1 });

export default mongoose.model<IAssessment>('Assessment', AssessmentSchema);
