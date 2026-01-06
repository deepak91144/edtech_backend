import twilio from 'twilio';

export const sendWhatsAppMessage = async (to: string, body: string) => {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

        if (!accountSid || !authToken || !whatsappNumber) {
            const missing = [];
            if (!accountSid) missing.push('TWILIO_ACCOUNT_SID');
            if (!authToken) missing.push('TWILIO_AUTH_TOKEN');
            if (!whatsappNumber) missing.push('TWILIO_WHATSAPP_NUMBER');
            console.warn(`Twilio credentials missing: ${missing.join(', ')}. Message not sent.`);
            return;
        }

        const client = twilio(accountSid, authToken);

        // Format phone number
        let formattedTo = to.replace(/\D/g, ''); // Remove non-digits
        if (formattedTo.length === 10) {
            formattedTo = `+91${formattedTo}`; // Default to India if 10 digits
        } else if (!formattedTo.startsWith('+')) {
            formattedTo = `+${formattedTo}`;
        }

        const message = await client.messages.create({
            body: body,
            from: `whatsapp:${whatsappNumber}`,
            to: `whatsapp:${formattedTo}`
        });

        console.log(`WhatsApp message sent to ${to}: ${message.sid}`);
        return message.sid;
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        throw error;
    }
};
