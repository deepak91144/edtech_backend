import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const fromNumber = process.env.TWILIO_PHONE_NUMBER;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

console.log('--- Debug Info ---');
console.log('TWILIO_PHONE_NUMBER:', fromNumber);
console.log('TWILIO_WHATSAPP_NUMBER:', whatsappNumber);

// Check if we are accidentally using the whatsapp fallback or something
const effectiveFrom = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '');
console.log('Effective FROM Number used in logic:', effectiveFrom);
