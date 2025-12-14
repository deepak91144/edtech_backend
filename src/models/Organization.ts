import mongoose, { Document, Schema } from 'mongoose';

export interface IOrganization extends Document {
    name: string;
    type: 'school' | 'college' | 'university';
    adminId: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>({
    name: {
        type: String,
        required: [true, 'Organization name is required'],
        trim: true
    },
    type: {
        type: String,
        required: [true, 'Organization type is required'],
        enum: {
            values: ['school', 'college', 'university'],
            message: '{VALUE} is not a valid organization type'
        }
    },
    adminId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Admin ID is required']
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field on save
organizationSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.model<IOrganization>('Organization', organizationSchema);
