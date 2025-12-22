import mongoose from 'mongoose';
import LiveClass from './src/models/LiveClass';
import dotenv from 'dotenv';

dotenv.config();

const clean = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected to DB');
        
        const result = await LiveClass.deleteMany({ 
            : [
                { hmsRoomId: { : false } },
                { hmsRoomId: '' },
                { hmsRoomId: null }
            ]
        });
        
        console.log(`Deleted ${result.deletedCount} broken live classes`);
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

clean();
