import mongoose, { Schema, Document } from 'mongoose';

export interface IComment {
    _id?: string;
    author: mongoose.Schema.Types.ObjectId;
    authorName: string; // De-normalize for easier display
    authorRole: 'student' | 'teacher' | 'org_admin';
    content: string;
    createdAt: Date;
}

export interface IForumPost extends Document {
    classId: mongoose.Schema.Types.ObjectId;
    author: mongoose.Schema.Types.ObjectId;
    authorName: string; // De-normalize for easier display
    authorRole: 'student' | 'teacher' | 'org_admin';
    title: string;
    content: string;
    isPinned: boolean;
    comments: IComment[];
    createdAt: Date;
    updatedAt: Date;
}

const CommentSchema: Schema = new Schema({
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    authorRole: { type: String, enum: ['student', 'teacher', 'org_admin'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

const ForumPostSchema: Schema = new Schema(
    {
        classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
        author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        authorName: { type: String, required: true },
        authorRole: { type: String, enum: ['student', 'teacher', 'org_admin'], required: true },
        title: { type: String, required: true },
        content: { type: String, required: true },
        isPinned: { type: Boolean, default: false },
        comments: [CommentSchema],
    },
    { timestamps: true }
);

export default mongoose.model<IForumPost>('ForumPost', ForumPostSchema);
