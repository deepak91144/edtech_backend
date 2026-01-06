import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const BASE_URL = 'http://localhost:5000/api';
const TEST_PHONE = '+919114411559';

const runTest = async () => {
    try {
        console.log('1. Registering temporary Admin...');
        const adminEmail = `tempadmin${Date.now()}@test.com`;
        const adminPass = 'password123';

        const registerRes = await axios.post(`${BASE_URL}/auth/register`, {
            email: adminEmail,
            password: adminPass,
            name: 'Temp Admin',
            userType: 'admin'
        });

        const token = registerRes.data.token;
        console.log('Admin Registered. Token obtained.');

        // 2. Fetch an Organization ID (or reuse one we know exists)
        // We will assume the one from fetch_org exists: 695176c216ac5d15db9b7943
        // But to be safe, let's create one or query one if we were real admins.
        // Since we are Platform Admin, we can query organizations.

        console.log('2. Fetching Organizations...');
        const orgRes = await axios.get(`${BASE_URL}/admin/organizations`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        let orgId = '695176c216ac5d15db9b7943'; // Default fallback
        if (orgRes.data.organizations && orgRes.data.organizations.length > 0) {
            orgId = orgRes.data.organizations[0]._id;
            console.log(`Using existing Organization: ${orgId}`);
        } else {
            console.log('No organizations found. Creating one...');
            const newOrg = await axios.post(`${BASE_URL}/admin/organizations`, {
                name: 'Test Org ' + Date.now(),
                type: 'school'
            }, { headers: { Authorization: `Bearer ${token}` } });
            orgId = newOrg.data.organization._id;
            console.log(`Created Organization: ${orgId}`);
        }

        console.log('3. Adding Teacher to Organization (Triggering WhatsApp)...');
        const teacherEmail = `addedteacher${Date.now()}@test.com`;

        await axios.post(`${BASE_URL}/organizations/${orgId}/users`, {
            name: 'Added Teacher',
            email: teacherEmail,
            password: 'password123',
            role: 'teacher',
            phoneNumber: TEST_PHONE,
            address: '123 Test St',
            salary: 50000
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Teacher Added Successfully!');
        console.log('Check WhatsApp for "Welcome Added Teacher! ... added to [Org Name]"');

    } catch (error: any) {
        if (error.response) {
            console.error('API Error:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
};

runTest();
