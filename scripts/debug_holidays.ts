
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';
import Organization from '../src/models/Organization';
import Holiday from '../src/models/Holiday';

dotenv.config();

const checkData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        console.log('Connected to MongoDB');

        // 1. Find all students
        const students = await User.find({ role: 'student' });
        console.log(`\nFound ${students.length} students:`);

        for (const student of students) {
            console.log(`- Student: ${student.name} (${student._id})`);
            console.log(`  OrgID on User: ${student.organizationId}`);

            if (student.organizationId) {
                // Check if org exists
                const org = await Organization.findById(student.organizationId);
                let adminEmail = 'Unknown';
                if (org && org.adminId) {
                    const admin = await User.findById(org.adminId);
                    adminEmail = admin ? admin.email : 'Unknown';
                }
                console.log(`  Organization: ${org ? org.name : 'NOT FOUND'} (ID: ${student.organizationId})`);
                console.log(`  Admin Email: ${adminEmail}`);

                // Check holidays for this org
                const holidays = await Holiday.find({ organizationId: student.organizationId });
                console.log(`  Holidays count: ${holidays.length}`);
                holidays.forEach(h => console.log(`    - ${h.title} on ${h.date}`));
            } else {
                console.log('  WARNING: No Organization ID linked to this student.');
            }
        }

        // 2. Check all holidays globally
        const allHolidays = await Holiday.find({});
        console.log(`\nTotal Holidays in DB: ${allHolidays.length}`);
        if (allHolidays.length > 0) {
            for (const h of allHolidays) {
                const org = await Organization.findById(h.organizationId);
                console.log(`- Holiday: "${h.title}" on ${h.date}`);
                console.log(`  Linked to Org: "${org ? org.name : 'Unknown'}" (ID: ${h.organizationId})`);
            }
        } else {
            console.log('  NO HOLIDAYS FOUND IN ENTIRE DB.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

checkData();
