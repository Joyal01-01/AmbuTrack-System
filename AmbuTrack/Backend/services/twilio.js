import twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Twilio using environment variables, or fallback to mock
let client = null;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

if (accountSid && authToken && fromNumber) {
    try {
        client = twilio(accountSid, authToken);
        console.log("Twilio initialized for SMS notifications.");
    } catch (e) {
        console.error("Twilio init failed, SMS will be mocked.", e.message);
    }
} else {
    console.log("Twilio credentials missing. SMS notifications will be mocked.");
}

/**
 * Sends an SMS to the specified phone number.
 * @param {string} to - Destination phone number (e.g., +9779812345678)
 * @param {string} body - The text message contents
 */
export const sendSMS = async (to, body) => {
    if (!to) return false;
    
    // Ensure format is correct for Nepal (+977) if no country code provided
    let formattedTo = to.toString();
    if (!formattedTo.startsWith('+')) {
        // Assume Nepal for AmbuTrack if not specified
        if (formattedTo.length === 10) formattedTo = '+977' + formattedTo;
    }

    if (client) {
        try {
            const message = await client.messages.create({
                body,
                from: process.env.TWILIO_FROM_NUMBER,
                to: formattedTo
            });
            console.log(`[Twilio] SMS sent to ${formattedTo}. SID: ${message.sid}`);
            return true;
        } catch (error) {
            console.error(`[Twilio Error] Failed sending SMS to ${formattedTo}:`, error.message);
            return false;
        }
    } else {
        // Mock sending
        console.log(`\n======================================`);
        console.log(`[MOCK SMS] To: ${formattedTo}`);
        console.log(`[MOCK SMS] Message: ${body}`);
        console.log(`======================================\n`);
        return true;
    }
};
