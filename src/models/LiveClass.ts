import mongoose, { Document, Schema } from 'mongoose';

export interface ILiveClass extends Document {
    title: string;
    classId: mongoose.Types.ObjectId;
    teacherId: mongoose.Types.ObjectId;
    organizationId: mongoose.Types.ObjectId;
    liveLink: string;
    hmsRoomId: string;
    startTime: Date;
    endTime: Date;
    isActive: boolean;
    createdAt: Date;
}

const LiveClassSchema: Schema = new Schema({
    title: { type: String, required: true },
    classId: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    liveLink: { type: String, required: true, unique: true },
    hmsRoomId: { type: String },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<ILiveClass>('LiveClass', LiveClassSchema);
