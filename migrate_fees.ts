
import mongoose from 'mongoose';
import FeeStructure from './src/models/FeeStructure';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/edtech_platform';

async function migrate() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        const structures = await FeeStructure.find({});
        console.log(`Found ${structures.length} structures.`);

        for (const s of structures) {
            let updated = false;
            // Migrate classId to classIds
            if ((s as any).classId && (!s.classIds || s.classIds.length === 0)) {
                s.classIds = [(s as any).classId];
                updated = true;
                console.log(`Migrating classId for ${s.name}`);
            }

            // Set default academic year if missing
            if (!s.academicYear) {
                s.academicYear = '2025'; // Default
                updated = true;
                console.log(`Setting default year for ${s.name}`);
            }

            if (updated) {
                // We need to use updateOne because .save() might validate mismatch if schema is strict?
                // Mongoose documents are usually flexible if schema allows.
                // But let's use updateOne to be safe against schema validation errors if old fields persist
                await FeeStructure.updateOne({ _id: s._id }, {
                    $set: {
                        classIds: s.classIds,
                        academicYear: s.academicYear
                    },
                    $unset: { classId: 1 } // Remove old field
                });
            }
        }
        console.log('Migration complete.');
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

migrate();
