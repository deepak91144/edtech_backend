
import mongoose from 'mongoose';
import FeeStructure from './src/models/FeeStructure';
import StudentFee from './src/models/StudentFee';
import User from './src/models/User';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/edtech_platform';

async function run() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Identify a student and organization
        const student = await User.findOne({ role: 'student' });
        if (!student) {
            console.log('No student found');
            return;
        }
        console.log(`Found student: ${student.name} (${student._id}) Org: ${student.organizationId}`);

        if (!student.organizationId) {
            console.log('Student has no organizationId');
            return;
        }

        // 2. Create 2 Fee Structures
        const fs1 = await FeeStructure.create({
            organizationId: student.organizationId,
            name: 'Test Fee 1 ' + Date.now(),
            amount: 100,
            dueDate: new Date(),
            type: 'ONE_TIME',
            description: 'Test Description 1'
        });
        console.log(`Created Fee Structure 1: ${fs1.name} (${fs1._id})`);

        const fs2 = await FeeStructure.create({
            organizationId: student.organizationId,
            name: 'Test Fee 2 ' + Date.now(),
            amount: 200,
            dueDate: new Date(),
            type: 'ONE_TIME',
            description: 'Test Description 2'
        });
        console.log(`Created Fee Structure 2: ${fs2.name} (${fs2._id})`);

        // 3. Assign both to the student (simulating global assign logic manually)
        // Logic from controller:
        /*
        const studentFees = students.map(student => ({
            studentId: student._id,
            feeStructureId,
            organizationId,
            amount: feeStructure.amount,
            paidAmount: 0,
            status: 'PENDING',
            dueDate: feeStructure.dueDate
        }));
        await StudentFee.insertMany(studentFees);
        */

        await StudentFee.create({
            studentId: student._id,
            feeStructureId: fs1._id,
            organizationId: student.organizationId,
            amount: fs1.amount,
            paidAmount: 0,
            status: 'PENDING',
            dueDate: fs1.dueDate
        });

        await StudentFee.create({
            studentId: student._id,
            feeStructureId: fs2._id,
            organizationId: student.organizationId,
            amount: fs2.amount,
            paidAmount: 0,
            status: 'PENDING',
            dueDate: fs2.dueDate
        });

        console.log('Assigned both fees to student.');

        // 4. Fetch fees for student
        const fees = await StudentFee.find({ studentId: student._id })
            .populate('feeStructureId', 'name description type')
            .sort({ dueDate: 1 });

        console.log(`Fetched ${fees.length} fees for student.`);
        fees.forEach(f => {
            console.log(`- ${f.feeStructureId ? (f.feeStructureId as any).name : 'Unknown Structure'}: ${f.amount} Status: ${f.status}`);
        });

        // Cleanup
        await StudentFee.collection.drop(); // Wipe fees to clean up? Or just leave them. Maybe better to delete what we created.
        await FeeStructure.deleteOne({ _id: fs1._id });
        await FeeStructure.deleteOne({ _id: fs2._id });
        await StudentFee.deleteMany({ feeStructureId: { $in: [fs1._id, fs2._id] } });
        console.log('Cleanup done.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

run();
