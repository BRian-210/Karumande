// utils/sendSMS.js
const AfricasTalking = require('africastalking');

/**
 * Initialize Africa's Talking client with better logging
 */
const initializeClient = () => {
  const apiKey = process.env.AT_API_KEY?.trim();
  const username = process.env.AT_USERNAME?.trim();

  if (!apiKey || !username) {
    console.error("❌ Africa's Talking credentials missing. Set AT_API_KEY and AT_USERNAME in .env");
    return null;
  }

  console.log(`🔄 Initializing Africa's Talking SMS - Username: ${username} | Environment: ${username === 'sandbox' ? 'SANDBOX' : 'PRODUCTION'}`);

  return AfricasTalking({
    apiKey,
    username,
  });
};

const atClient = initializeClient();
const smsClient = atClient ? atClient.SMS : null;

/**
 * Send SMS via Africa's Talking
 */
const sendSMS = async ({ to, message, from = 'KARUMANDE' }) => {
  if (!to || typeof to !== 'string') {
    throw new Error('Recipient phone number is required');
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new Error('Message content is required');
  }

  const recipients = to.split(',').map(num => num.trim()).filter(Boolean);

  if (recipients.length === 0) {
    throw new Error('No valid phone numbers provided');
  }

  const options = {
    to: recipients,
    message: message.trim(),
    from: from.trim(),
  };

  if (!smsClient) {
    console.warn("⚠️ SMS client not initialized. Skipping SMS.");
    return { success: false, error: "SMS service not configured" };
  }

  try {
    const response = await smsClient.send(options);

    console.log('✅ SMS sent successfully:', {
      recipients,
      sender: options.from,
      messageLength: options.message.length,
      response: response.SMSMessageData
    });

    return { success: true, response };
  } catch (error) {
    console.error('❌ Failed to send SMS:', {
      recipients,
      errorCode: error.code,
      errorMessage: error.message,
      statusCode: error.statusCode || error.response?.status,
      fullError: error
    });

    // Provide more helpful message for 401
    if (error.statusCode === 401 || error.code === 401) {
      console.error("🔑 401 Unauthorized - Check your AT_API_KEY and AT_USERNAME. Make sure you are using PRODUCTION credentials (not Sandbox).");
    }

    return { 
      success: false, 
      error: error.message || 'SMS sending failed',
      code: error.statusCode || error.code 
    };
  }
};

module.exports = sendSMS;