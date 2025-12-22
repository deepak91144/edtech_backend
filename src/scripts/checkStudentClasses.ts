
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Class from '../models/Class';
import User from '../models/User';
import Organization from '../models/Organization';

dotenv.config();

const checkStudentClasses = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        console.log('Connected to MongoDB');


        console.log('Registered Models:', mongoose.modelNames());

        // Find the student
        const student = await User.findOne({ name: { $regex: /student five/i } });

        if (!student) {
            console.log('Student Five not found');
            return;
        }

        console.log(`Found Student: ${student.name} (${student._id})`);

        // Find classes containing this student
        const classes = await Class.find({ studentIds: student._id }); // Removed populate for now to debug

        if (classes.length > 1) {
            console.log('Duplicate enrollment found. Removing from older class...');
            // Sort by ID to find older (assuming MongoDB ObjectId monotonicity)
            classes.sort((a, b) => a._id.toString().localeCompare(b._id.toString()));

            // Keep the last one (newest), remove others
            const classToKeep = classes[classes.length - 1];
            const classesToRemove = classes.slice(0, classes.length - 1);

            for (const cls of classesToRemove) {
                console.log(`Removing student from Class: ${cls.name} (${cls._id})`);
                await Class.updateOne(
                    { _id: cls._id },
                    { $pull: { studentIds: student._id } }
                );
                console.log('Removed.');
            }
            console.log(`Student remains in Class: ${classToKeep.name}`);
        } else {
            console.log('No duplicate enrollments found.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

checkStudentClasses();
