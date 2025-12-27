import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/edtech_platform';

async function verifyClassMapping() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Fetch all Classes and print their IDs and Student IDs
        const classes = await mongoose.model('Class', new mongoose.Schema({
            name: String,
            organizationId: mongoose.Schema.Types.ObjectId,
            studentIds: [mongoose.Schema.Types.ObjectId]
        })).find({}, 'name organizationId studentIds').lean();

        console.log('\n--- All Classes ---');
        const studentClassMap: Record<string, string> = {};

        classes.forEach((cls: any) => {
            console.log(`Class: ${cls.name} (${cls._id})`);
            console.log(`  Org: ${cls.organizationId}`);
            console.log(`  Student Count: ${cls.studentIds?.length || 0}`);
            if (cls.studentIds && cls.studentIds.length > 0) {
                console.log(`  Sample Student IDs: ${cls.studentIds.slice(0, 3).map((id: any) => id.toString()).join(', ')}`);
            }

            if (cls.studentIds) {
                cls.studentIds.forEach((sId: any) => {
                    studentClassMap[sId.toString()] = cls.name;
                });
            }
        });

        // 2. Fetch a few StudentFees and try to map them
        const fees = await mongoose.model('StudentFee', new mongoose.Schema({
            studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            organizationId: mongoose.Schema.Types.ObjectId
        })).find({})
            .limit(10)
            .lean();

        console.log('\n--- Sample Student Fees Mapping ---');
        fees.forEach((fee: any) => {
            const sId = fee.studentId?.toString();
            // const sName = fee.studentId?.name; // Cannot get name without populate or User lookup
            const mappedClass = studentClassMap[sId];

            console.log(`Fee FeeID: ${fee._id}`);
            console.log(`  StudentID: ${sId}`);
            console.log(`  Mapped Class Check: ${mappedClass || 'Unassigned'}`);

            if (!mappedClass) {
                console.log(`  [DEBUG] Student ID ${sId} NOT found in studentClassMap.`);
            }
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

verifyClassMapping();
