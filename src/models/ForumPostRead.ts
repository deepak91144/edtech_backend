import mongoose, { Schema, Document } from 'mongoose';

export interface IForumPostRead extends Document {
    userId: mongoose.Schema.Types.ObjectId;
    postId: mongoose.Schema.Types.ObjectId;
    lastReadAt: Date;
}

const ForumPostReadSchema: Schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    postId: { type: Schema.Types.ObjectId, ref: 'ForumPost', required: true },
    lastReadAt: { type: Date, default: Date.now },
});

// Ensure a user has only one read record per post
ForumPostReadSchema.index({ userId: 1, postId: 1 }, { unique: true });

export default mongoose.model<IForumPostRead>('ForumPostRead', ForumPostReadSchema);
