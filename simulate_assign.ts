
import mongoose from 'mongoose';
import User from './src/models/User';
import StudentFee from './src/models/StudentFee';
import FeeStructure from './src/models/FeeStructure';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/edtech_platform';

const ORG_ID = '694111ff1464d6ba80d9e171';
const FEE_ID = '694e9daf8f61a5be906884db'; // "fees one"

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        // 1. Fetch Fee Structure
        const feeStructure = await FeeStructure.findById(FEE_ID);
        if (!feeStructure) {
            console.log('Fee Structure not found');
            return;
        }
        console.log('Fee Structure:', feeStructure.name);

        // 2. Fetch Students (Global Logic)
        const students = await User.find({
            organizationId: ORG_ID,
            role: 'student'
        });
        console.log(`Found ${students.length} students.`);

        if (students.length === 0) return;

        // 3. Check Existing
        const existingFees = await StudentFee.find({
            feeStructureId: FEE_ID,
            studentId: { $in: students.map(s => s._id) }
        });
        console.log(`Existing fees count: ${existingFees.length}`);

        const existingStudentIds = new Set(existingFees.map(f => f.studentId.toString()));

        // 4. Prepare New Fees
        const studentFees = students
            .filter(student => !existingStudentIds.has(student._id.toString()))
            .map(student => ({
                studentId: student._id,
                feeStructureId: FEE_ID,
                organizationId: ORG_ID,
                amount: feeStructure.amount,
                paidAmount: 0,
                status: 'PENDING',
                dueDate: feeStructure.dueDate
            }));

        console.log(`Prepared ${studentFees.length} new fees.`);

        // 5. Insert (Commented out to just simulate, or uncomment to fix?)
        // Let's uncomment to actually fix it for the user if this works! 
        // But first let's see if it Would work.

        if (studentFees.length > 0) {
            const result = await StudentFee.insertMany(studentFees);
            console.log(`Inserted ${result.length} fees.`);
        } else {
            console.log('No fees to insert.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}

run();
