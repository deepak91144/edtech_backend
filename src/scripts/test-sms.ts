import dotenv from 'dotenv';
import path from 'path';
import { sendSMS } from '../utils/sms';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const TEST_PHONE = '+919114411559';

const runTest = async () => {
    try {
        console.log(`Attempting to send SMS to ${TEST_PHONE}...`);
        const sid = await sendSMS(TEST_PHONE, 'Test SMS from EdTech Platform');
        if (sid) {
            console.log('SMS Sent Successfully! SID:', sid);
        } else {
            console.log('Failed to send SMS (No SID returned).');
        }
    } catch (error: any) {
        console.error('Test Failed:', error.message);
        if (error.code === 21606) {
            console.error('Error 21606: The "From" phone number provided is not a valid, SMS-capable inbound phone number for your account.');
        }
    }
};

runTest();
