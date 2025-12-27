
import mongoose from 'mongoose';
import User from './src/models/User';
import StudentFee from './src/models/StudentFee';
import FeeStructure from './src/models/FeeStructure';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/edtech_platform';

const TARGET_ORG_ID = '694111ff1464d6ba80d9e171'; // From user prompt

async function inspect() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        // 1. List Students in Org
        const students = await User.find({ organizationId: TARGET_ORG_ID, role: 'student' });
        console.log(`Found ${students.length} students in Org ${TARGET_ORG_ID}`);
        students.forEach(s => console.log(`- ${s.name} (${s._id})`));

        if (students.length === 0) {
            console.log('WARNING: No students found. Assignment will do nothing.');
        }

        // 2. List Fee Structures in Org
        const structures = await FeeStructure.find({ organizationId: TARGET_ORG_ID });
        console.log(`Found ${structures.length} fee structures in Org ${TARGET_ORG_ID}`);
        structures.forEach(s => console.log(`- ${s.name} (${s._id})`));

        // 3. Check Fees for these students
        const studentIds = students.map(s => s._id);
        const fees = await StudentFee.find({
            organizationId: TARGET_ORG_ID,
            studentId: { $in: studentIds }
        });
        console.log(`Found ${fees.length} Total StudentFee records for these students.`);
        fees.forEach(f => console.log(`- Fee for ${f.studentId}: Structure ${f.feeStructureId} Amount ${f.amount}`));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

inspect();
