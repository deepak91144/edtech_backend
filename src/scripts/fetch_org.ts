import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const fetchOrg = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);
        const collection = mongoose.connection.collection('organizations');
        const org = await collection.findOne({});
        if (org) {
            console.log('ORG_ID=' + org._id);
        } else {
            console.log('NO_ORG_FOUND');
        }
        await mongoose.disconnect();
    } catch (error) {
        console.error(error);
    }
};

fetchOrg();
