// utils/sendSMS.js
const AfricasTalking = require('africastalking');

/**
 * Africa's Talking client instance
 * Initialized once and reused across requests
 */
const initializeClient = () => {
  const apiKey = process.env.AT_API_KEY?.trim();
  const username = process.env.AT_USERNAME?.trim();

  if (!apiKey || !username) {
    console.warn("Africa's Talking credentials missing: AT_API_KEY and/or AT_USERNAME not set. SMS sending is disabled.");
    return null;
  }

  return AfricasTalking({
    apiKey,
    username,
  });
};

const atClient = initializeClient();
const smsClient = atClient ? atClient.SMS : null;

/**
 * Sends an SMS via Africa's Talking
 * @param {Object} options
 * @param {string} options.to - Recipient phone number(s) in international format (e.g., +2547xxxxxxxx)
 * @param {string} options.message - Message content (max 160 characters for single SMS)
 * @param {string} [options.from='KARUMANDE'] - Optional sender ID (must be approved by Africa's Talking)
 * @returns {Promise<Object>} Africa's Talking API response
 * @throws {Error} If sending fails or inputs are invalid
 */
const sendSMS = async ({ to, message, from = 'KARUMANDE' }) => {
  // Basic input validation
  if (!to || typeof to !== 'string') {
    throw new Error('Valid recipient phone number(s) required');
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('Message content is required and cannot be empty');
  }

  const cleanedMessage = message.trim();
  const recipients = to.split(',').map(num => num.trim()).filter(num => num);

  if (recipients.length === 0) {
    throw new Error('No valid phone numbers provided');
  }

  const options = {
    to: recipients,
    message: cleanedMessage,
    from: from.trim(),
  };

  if (!smsClient) {
    const msg = "SMS client not configured; skipping SMS send";
    console.warn(msg, { to: recipients });
    return { success: false, error: msg };
  }

  try {
    const response = await smsClient.send(options);

    console.log('SMS sent successfully:', {
      recipients: options.to,
      messageLength: cleanedMessage.length,
      senderId: options.from,
      response: response, // Contains SMSMessageData with status per recipient
    });

    return { success: true, response };
  } catch (error) {
    console.error('Failed to send SMS:', {
      recipients: options.to,
      errorCode: error.code,
      errorMessage: error.message,
      statusCode: error.statusCode,
    });

    // Return error but do not throw so notification failures don't block main flow
    return { success: false, error: error.message || 'Unknown error' };
  }
};

// Optional: Validate credentials on startup
if (process.env.NODE_ENV !== 'test') {
  try {
    // Africa's Talking doesn't have a direct "verify" endpoint,
    // but we can log readiness
    console.log('Africa\'s Talking SMS client initialized');
    console.log('Sender ID:', 'KARUMANDE');
  } catch (err) {
    console.error('Africa\'s Talking initialization failed:', err.message);
  }
}

module.exports = sendSMS;