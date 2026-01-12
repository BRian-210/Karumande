// utils/sendEmail.js
const nodemailer = require('nodemailer');

/**
 * Nodemailer transporter instance
 * Uses Gmail by default — consider switching to dedicated services (SendGrid, Mailgun, etc.) for better deliverability
 */
const createTransporter = () => {
  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_APP_PASSWORD?.trim();

  if (!user || !pass) {
    console.warn('Email configuration incomplete: EMAIL_USER or EMAIL_APP_PASSWORD missing. Email sending is disabled.');
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass, // Use App Password, NOT your regular Gmail password
    },
    tls: {
      rejectUnauthorized: false, // Optional: helps with some connectivity issues (use cautiously)
    },
  });
};

// Create transporter once (reused across requests)
const transporter = createTransporter();

/**
 * Sends an email using Nodemailer
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.html - HTML body content
 * @param {string} [options.text] - Optional plain text fallback
 * @returns {Promise<void>}
 * @throws {Error} If sending fails
 */
const sendEmail = async ({ to, subject, html, text }) => {
  if (!to || !subject || !html) {
    const err = 'Missing required email fields: to, subject, or html';
    console.warn('Email not sent:', err);
    return { success: false, error: err };
  }

  if (!transporter) {
    const msg = 'Email transporter not configured; skipping email send';
    console.warn(msg, { to, subject });
    return { success: false, error: msg };
  }

  const mailOptions = {
    from: {
      name: 'Karumande School',
      address: process.env.EMAIL_USER,
    },
    to: to.trim(),
    subject: subject.trim(),
    html: html.trim(),
    text: text?.trim(), // Optional plain-text version (improves deliverability)
  };

  try {
    const info = await transporter.sendMail(mailOptions);

    console.log('Email sent successfully:', {
      messageId: info.messageId,
      response: info.response,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });

    return { success: true, info };
  } catch (error) {
    console.error('Failed to send email:', {
      to,
      subject,
      error: error.message,
      code: error.code,
    });

    // Return error but do not throw so notifications remain optional
    return { success: false, error: error.message };
  }
};

// Optional: Verify transporter on startup (highly recommended in production)
// Verify transporter on startup (non-blocking)
if (process.env.NODE_ENV !== 'test') {
  if (transporter) {
    transporter.verify((error) => {
      if (error) {
        console.error('Email transporter configuration error:', error.message || error);
      } else {
        console.log('Email transporter ready – SMTP connection verified');
      }
    });
  } else {
    console.warn('Email transporter not configured; emails will be skipped. Set EMAIL_USER and EMAIL_APP_PASSWORD to enable.');
  }
}

module.exports = sendEmail;