import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/edtech_platform';

async function verifyControllerLogic() {
    try {
        await mongoose.connect(MONGODB_URI);

        // Mock Organization ID from previous debug output
        // Class: second class of school y (69413a84c1298ffea8241a69) -> Org: 694111ff1464d6ba80d9e171
        const organizationId = '694111ff1464d6ba80d9e171';

        console.log(`Testing Organization: ${organizationId}`);

        // 1. Fetch Fees (Mimic simple find + populate, assuming Student has _id, name, email)
        // Since we can't easily populate 'User' without schema, using simple version or defining User
        const UserSchema = new mongoose.Schema({ name: String, email: String });
        if (!mongoose.models.User) mongoose.model('User', UserSchema);

        const StudentFeeSchema = new mongoose.Schema({
            studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            feeStructureId: { type: mongoose.Schema.Types.ObjectId },
            organizationId: mongoose.Schema.Types.ObjectId,
            status: String
        });
        const StudentFee = mongoose.models.StudentFee || mongoose.model('StudentFee', StudentFeeSchema);

        const FeeStructureSchema = new mongoose.Schema({ name: String });
        if (!mongoose.models.FeeStructure) mongoose.model('FeeStructure', FeeStructureSchema);

        let feesQuery = StudentFee.find({ organizationId })
            .populate('studentId', 'name email')
            .populate('feeStructureId', 'name')
            .lean();

        const fees: any[] = await feesQuery.exec();
        console.log(`Fetched ${fees.length} fees`);

        // 2. Fetch Classes (Mimic Controller)
        // Need to define Class model if not exists
        const ClassSchema = new mongoose.Schema({
            name: String,
            organizationId: mongoose.Schema.Types.ObjectId,
            studentIds: [mongoose.Schema.Types.ObjectId]
        });
        const ClassModel = mongoose.models.Class || mongoose.model('Class', ClassSchema);

        const classes = await ClassModel.find({ organizationId }, 'name studentIds').lean();
        console.log(`Fetched ${classes.length} classes`);

        // 3. Map Logic (COPY PASTE FROM CONTROLLER)
        const studentClassMap: Record<string, string> = {};

        classes.forEach((cls: any) => {
            if (cls.studentIds) {
                cls.studentIds.forEach((sId: any) => {
                    studentClassMap[sId.toString()] = cls.name;
                });
            }
        });

        // 4. Attach Logic
        const feesWithClass = fees.map(fee => {
            if (fee.studentId && typeof fee.studentId === 'object') {
                const sId = fee.studentId._id?.toString();
                const mapped = studentClassMap[sId];
                fee.studentId.className = mapped || 'Unassigned';

                // Debug log for each
                // console.log(`Student ${fee.studentId.name} (${sId}) -> ${fee.studentId.className}`);
            }
            return fee;
        });

        // 5. Verify results
        const assignedCount = feesWithClass.filter(f => f.studentId?.className && f.studentId.className !== 'Unassigned').length;
        console.log(`Assigned Classes: ${assignedCount} / ${feesWithClass.length}`);

        // Print samples
        feesWithClass.slice(0, 5).forEach(f => {
            console.log(`Fee ${f._id}: Student ${f.studentId?.name} -> Class: ${f.studentId?.className}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await mongoose.disconnect();
    }
}

verifyControllerLogic();
