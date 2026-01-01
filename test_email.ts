import dotenv from 'dotenv';
import { sendEmail } from './src/utils/mail';

dotenv.config();

async function testEmail() {
    console.log('Testing email sending...');

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('No SMTP credentials found in .env. Falling back to Ethereal Email (mock)...');
        // In a real environment, you might want to create a test account here
        // but for this script we will just log what would have happened if we can't send.
    }

    try {
        await sendEmail({
            to: 'test@example.com',
            subject: 'Test Email',
            text: 'This is a test email from the EdTech Platform.',
            html: '<p>This is a <strong>test email</strong> from the EdTech Platform.</p>'
        });
        console.log('Test email sent successfully!');
    } catch (error) {
        console.error('Test email failed:', error);
    }
}

testEmail();
