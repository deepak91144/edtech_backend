// Script to add targetAudience field to existing announcements
// This ensures backward compatibility

import mongoose from 'mongoose';
import Announcement from '../models/Announcement';
import dotenv from 'dotenv';

dotenv.config();

async function updateExistingAnnouncements() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/edtech');
        console.log('✅ Connected to MongoDB');

        // Update all announcements that don't have targetAudience field
        const result = await Announcement.updateMany(
            { targetAudience: { $exists: false } },
            { $set: { targetAudience: 'students' } }
        );

        console.log(`✅ Updated ${result.modifiedCount} announcements with default targetAudience: 'students'`);

        // Disconnect
        await mongoose.disconnect();
        console.log('✅ Disconnected from MongoDB');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

updateExistingAnnouncements();
