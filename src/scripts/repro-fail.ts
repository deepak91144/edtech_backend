import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const BASE_URL = 'http://localhost:5000/api';
const TEST_PHONE_RAW = '9114411559'; // NO +91

const runTest = async () => {
    try {
        console.log('Testing with raw number:', TEST_PHONE_RAW);

        // We will try to invoke the notification logic directly or via a mock if possible.
        // But since we can't easily isolate just the function in a script without mocking DB, 
        // let's just use the utils function directly to see if it fails with raw number.

        const { sendWhatsAppMessage } = require('../utils/whatsapp');

        console.log('Sending message to raw number...');
        await sendWhatsAppMessage(TEST_PHONE_RAW, 'Test message with raw number');
        console.log('Success?'); // If this prints, it means Twilio accepted it or our try/catch swallowed it?

    } catch (error: any) {
        console.error('Caught Error:', error);
    }
};

runTest();
