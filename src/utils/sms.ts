import twilio from 'twilio';

export const sendSMS = async (to: string, body: string) => {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:', '');
        // Note: TWILIO_WHATSAPP_NUMBER in .env usually doesn't have 'whatsapp:' prefix in the value itself, 
        // the code added it. Let's check how it was stored. I'll check .env shortly.
        // If the user only has a WhatsApp sandbox number, it might NOT support SMS. 
        // But the user said "you already have twilo set up". 
        // I'll try to use the same number.

        if (!accountSid || !authToken || !fromNumber) {
            console.warn('Twilio credentials or phone number missing for SMS.');
            return;
        }

        const client = twilio(accountSid, authToken);

        // Format phone number (E.164)
        let formattedTo = to.replace(/\D/g, '');
        if (formattedTo.length === 10) {
            formattedTo = `+91${formattedTo}`;
        } else if (!formattedTo.startsWith('+')) {
            formattedTo = `+${formattedTo}`;
        }

        const message = await client.messages.create({
            body: body,
            from: fromNumber, // No 'whatsapp:' prefix
            to: formattedTo   // No 'whatsapp:' prefix
        });

        console.log(`SMS sent to ${formattedTo}: ${message.sid}`);
        return message.sid;
    } catch (error) {
        console.error('Error sending SMS:', error);
        throw error;
    }
};
