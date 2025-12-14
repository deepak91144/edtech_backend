import mongoose, { Document, Schema } from 'mongoose';

export interface IAnnouncement extends Document {
    title: string;
    content: string;
    link?: string;
    authorId: mongoose.Types.ObjectId;
    organizationId: mongoose.Types.ObjectId;
    targetClassIds: mongoose.Types.ObjectId[];
    createdAt: Date;
}

const AnnouncementSchema: Schema = new Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    link: { type: String },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    targetClassIds: [{ type: Schema.Types.ObjectId, ref: 'Class' }],
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IAnnouncement>('Announcement', AnnouncementSchema);
