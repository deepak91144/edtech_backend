
import dotenv from 'dotenv';
import path from 'path';
import * as HMS from '@100mslive/server-sdk';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const accessKey = process.env.HMS_ACCESS_KEY;
const secret = process.env.HMS_SECRET;
const templateId = process.env.HMS_TEMPLATE_ID;

async function inspectTemplate() {
    if (!accessKey || !secret) {
        console.error('Credentials missing');
        return;
    }

    if (!templateId) {
        console.error('HMS_TEMPLATE_ID is missing');
        return;
    }

    console.log(`Inspecting template: ${templateId}`);

    // Generate Management Token manually
    const payload = {
        access_key: accessKey,
        type: 'management',
        version: 2,
        iat: Math.floor(Date.now() / 1000),
        nbf: Math.floor(Date.now() / 1000)
    };

    const token = jwt.sign(
        payload,
        secret,
        {
            algorithm: 'HS256',
            expiresIn: '1h',
            jwtid: uuidv4()
        }
    );

    try {
        const response = await axios.get(`https://api.100ms.live/v2/templates/${templateId}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const template = response.data;
        console.log('Template Found:', template.name);

        const roles = Object.keys(template.roles);
        console.log('--- ROLES ---');
        console.log(roles.join(', '));
        console.log('-------------');

    } catch (err: any) {
        console.error('Failed to fetch template:', err.response?.data || err.message);
    }
}

inspectTemplate();
