import mongoose, { Document, Schema } from 'mongoose';

export interface ISubmission extends Document {
    assessmentId: mongoose.Types.ObjectId;
    studentId: mongoose.Types.ObjectId;
    answers: {
        questionId: string;
        answer: string | string[];
        marks?: number;
    }[];
    obtainedMarks?: number;
    status: 'submitted' | 'graded';
    feedback?: string;
    submittedAt: Date;
    gradedAt?: Date;
}

const SubmissionSchema: Schema = new Schema({
    assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    answers: [{
        questionId: { type: String, required: true },
        answer: { type: Schema.Types.Mixed, required: true }, // String or Array of Strings
        marks: { type: Number }
    }],
    obtainedMarks: { type: Number },
    status: {
        type: String,
        enum: ['submitted', 'graded'],
        default: 'submitted'
    },
    feedback: { type: String },
    submittedAt: { type: Date, default: Date.now },
    gradedAt: { type: Date }
}, {
    timestamps: true
});

// Indexes
SubmissionSchema.index({ assessmentId: 1, studentId: 1 }, { unique: true }); // One submission per student per assessment
SubmissionSchema.index({ studentId: 1 });

export default mongoose.model<ISubmission>('Submission', SubmissionSchema);
