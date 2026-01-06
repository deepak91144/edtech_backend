import dotenv from 'dotenv';
import path from 'path';
import { sendWhatsAppMessage } from '../utils/whatsapp';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const testWhatsApp = async () => {
    const to = process.argv[2];

    if (!to) {
        console.error('Usage: ts-node src/scripts/test-whatsapp.ts <phone_number_with_country_code>');
        console.error('Example: ts-node src/scripts/test-whatsapp.ts +1234567890');
        process.exit(1);
    }

    console.log(`Attempting to send test message to ${to}...`);
    console.log('Using Account SID:', process.env.TWILIO_ACCOUNT_SID ? '*****' + process.env.TWILIO_ACCOUNT_SID.slice(-4) : 'MISSING');

    try {
        const sid = await sendWhatsAppMessage(to, 'Hello from EdTech Platform! This is a test message.');
        console.log('Successfully sent message. SID:', sid);
    } catch (error) {
        console.error('Failed to send message:', error);
    }
};

testWhatsApp();
