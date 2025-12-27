
import mongoose from 'mongoose';
import FeeStructure from './src/models/FeeStructure';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/edtech_platform';

async function check() {
    try {
        await mongoose.connect(MONGODB_URI);
        const s = await FeeStructure.findOne();
        console.log(JSON.stringify(s?.toJSON(), null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
check();
