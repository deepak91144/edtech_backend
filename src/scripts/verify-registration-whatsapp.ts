import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_URL = 'http://localhost:5000/api/auth/register';
const TEST_PHONE = '+919114411559'; // User's number

const registerUser = async () => {
    const randomId = Math.floor(Math.random() * 10000);
    const email = `testuser${randomId}@example.com`;

    console.log(`Registering user: ${email} with phone: ${TEST_PHONE}`);

    try {
        const response = await axios.post(API_URL, {
            email,
            password: 'password123',
            name: 'Test WhatsApp User',
            userType: 'student',
            organizationId: '695176c216ac5d15db9b7943',
            // Actually, let's try creating a teacher/student without organizationId if validation fails?
            // "Organization ID is required for teachers and students" - auth.ts line 160.
            phoneNumber: TEST_PHONE
        });

        console.log('Registration Successful:', response.data.success);
        console.log('Check your WhatsApp for the welcome message!');
    } catch (error: any) {
        if (error.response) {
            console.error('Registration Failed:', error.response.data);
            if (error.response.data.message === 'Organization ID is required for teachers and students') {
                console.log('Need a valid Organization ID. Fetching one...');
                // If this fails, I might need to login as admin first to get an org ID.
            }
        } else {
            console.error('Error:', error.message);
        }
    }
};

registerUser();
