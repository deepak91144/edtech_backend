import mongoose, { Document, Schema } from 'mongoose';

export interface IResource extends Document {
    title: string;
    type: 'file' | 'link' | 'video';
    url: string; // File path or external URL
    classId: mongoose.Types.ObjectId;
    uploadedBy: mongoose.Types.ObjectId;
    organizationId: mongoose.Types.ObjectId;
    createdAt: Date;
}

const ResourceSchema: Schema = new Schema({
    title: { type: String, required: true },
    type: { type: String, enum: ['file', 'link', 'video'], required: true },
    url: { type: String, required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true }, // To keep resources scoped
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IResource>('Resource', ResourceSchema);
