
import dotenv from 'dotenv';
import path from 'path';
import * as HMS from '@100mslive/server-sdk';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const accessKey = process.env.HMS_ACCESS_KEY;
const secret = process.env.HMS_SECRET;
const templateId = process.env.HMS_TEMPLATE_ID; // || 'default_videoconf_7e5e3e8c-8598-4b71-9257-22d86104ca87'; 
// Note: I want to see what happens if I rely on the SAME logic as the app.
// But checking the file `backend/src/routes/liveClass.ts`, it uses the fallback if env is missing.

async function testRoles() {
    if (!accessKey || !secret) {
        console.error('HMS_ACCESS_KEY or HMS_SECRET not found in environment');
        return;
    }

    const hms = new HMS.SDK(accessKey, secret);

    console.log('Credentials found.');
    console.log('Template ID from env:', templateId || 'Not set (using default)');

    const effectiveTemplateId = templateId || 'default_videoconf_7e5e3e8c-8598-4b71-9257-22d86104ca87';

    try {
        console.log(`Creating room with template: ${effectiveTemplateId}`);
        const room = await hms.rooms.create({
            name: `debug-roles-${Date.now()}`,
            template_id: effectiveTemplateId
        });
        console.log('Room created:', room.id);

        const rolesToTest = ['host', 'guest', 'teacher', 'student', 'broadcaster', 'viewer'];

        for (const role of rolesToTest) {
            try {
                await hms.auth.getAuthToken({
                    roomId: room.id,
                    role: role,
                    userId: 'test-user'
                });
                console.log(`✅ Role '${role}' is VALID`);
            } catch (err: any) {
                console.log(`❌ Role '${role}' is INVALID: ${err.message}`);
            }
        }

    } catch (err: any) {
        console.error('Error during test:', err);
    }
}

testRoles();
