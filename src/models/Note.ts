import mongoose, { Schema, Document } from 'mongoose';

export interface INote extends Document {
    user: mongoose.Types.ObjectId;
    title: string;
    content: string;
    color: string;
    tags: string[];
    isPinned: boolean;
    classId?: mongoose.Types.ObjectId;
    sharedBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const NoteSchema = new Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        title: {
            type: String,
            required: [true, 'Please add a title'],
            trim: true,
            maxlength: [100, 'Title cannot be more than 100 characters'],
        },
        content: {
            type: String,
            required: [true, 'Please add content'],
        },
        color: {
            type: String,
            default: '#ffffff', // Default white
        },
        tags: {
            type: [String],
            default: [],
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Class',
            required: false,
        },
        sharedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<INote>('Note', NoteSchema);
