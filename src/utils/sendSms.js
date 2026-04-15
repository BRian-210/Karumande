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
const sendSMS = async ({ to, message, from = process.env.AT_SENDER_ID || 'KARUMANDE' }) => {
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

  if (!smsClient) {
    const msg = "SMS client not configured; skipping SMS send";
    console.warn(msg, { to: recipients });
    return { success: false, error: msg };
  }

  const buildOptions = (senderId) => {
    const options = {
      to: recipients,
      message: cleanedMessage,
    };

    if (senderId && senderId.trim()) {
      options.from = senderId.trim();
    }

    return options;
  };

  const trySend = async (options) => {
    const response = await smsClient.send(options);
    const apiMessage = response?.SMSMessageData?.Message || '';
    const deliveredRecipients = response?.SMSMessageData?.Recipients || [];
    const hasInvalidSenderId = /InvalidSenderId/i.test(apiMessage);

    if (hasInvalidSenderId) {
      return {
        success: false,
        error: apiMessage,
        response,
        retryWithoutSenderId: Boolean(options.from),
      };
    }

    if (!deliveredRecipients.length) {
      return {
        success: false,
        error: apiMessage || 'SMS provider accepted request but returned no recipients',
        response,
      };
    }

    console.log('SMS sent successfully:', {
      recipients: options.to,
      messageLength: cleanedMessage.length,
      senderId: options.from || '(default)',
      response,
    });

    return { success: true, response };
  };

  try {
    const primaryResult = await trySend(buildOptions(from));
    if (primaryResult.success) return primaryResult;

    if (primaryResult.retryWithoutSenderId) {
      console.warn('SMS sender ID rejected by provider; retrying without sender ID.', {
        recipients,
        senderId: from,
      });

      const fallbackResult = await trySend(buildOptions(''));
      if (fallbackResult.success) return fallbackResult;

      console.error('Failed to send SMS:', {
        recipients,
        senderId: from,
        errorMessage: fallbackResult.error,
        response: fallbackResult.response,
      });
      return { success: false, error: fallbackResult.error || 'Unknown error', response: fallbackResult.response };
    }

    console.error('Failed to send SMS:', {
      recipients,
      senderId: from,
      errorMessage: primaryResult.error,
      response: primaryResult.response,
    });
    return { success: false, error: primaryResult.error || 'Unknown error', response: primaryResult.response };
  } catch (error) {
    console.error('Failed to send SMS:', {
      recipients,
      senderId: from,
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
