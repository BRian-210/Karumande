// utils/sendEmail.js
const nodemailer = require('nodemailer');

const createTransporter = () => {
  const user = process.env.EMAIL_USER?.trim();
  // Support app-passwords pasted with spaces (e.g. "abcd efgh ijkl mnop")
  const rawPass = process.env.EMAIL_APP_PASSWORD || '';
  const pass = rawPass ? String(rawPass).trim().replace(/\s+/g, '') : '';

  if (!user || !pass) {
    console.warn('Email configuration incomplete: EMAIL_USER or EMAIL_APP_PASSWORD missing. Email sending is disabled.');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_SMTP_PORT ? Number(process.env.EMAIL_SMTP_PORT) : 465,
    secure: process.env.EMAIL_SMTP_SECURE ? process.env.EMAIL_SMTP_SECURE === 'true' : true,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false, // optional
    },
    // Timeouts to fail fast and produce clearer errors when network is blocking
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    logger: process.env.NODE_ENV !== 'production',
    debug: process.env.NODE_ENV !== 'production',
  });
};

// Create transporter once (reused across requests)
const transporter = createTransporter();

const shouldRetryEmail = (error) => {
  return ['ETIMEDOUT', 'ESOCKET', 'ECONNECTION'].includes(error?.code);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendEmail = async ({ to, subject, html, text, replyTo }) => {
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
    text: text?.trim(),
    ...(replyTo ? { replyTo: replyTo.trim() } : {}),
  };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', {
        messageId: info.messageId,
        response: info.response,
        to: mailOptions.to,
        subject: mailOptions.subject,
        attempt,
      });
      return { success: true, info };
    } catch (error) {
      const finalAttempt = attempt === 2 || !shouldRetryEmail(error);
      console.error('Failed to send email:', {
        to,
        subject,
        error: error.message,
        code: error.code,
        attempt,
      });

      if (finalAttempt) {
        return { success: false, error: error.message };
      }

      await wait(1500);
    }
  }
};

// Verify transporter on startup
if (process.env.NODE_ENV !== 'test') {
  if (transporter) {
    transporter.verify((error) => {
      if (error) {
        console.error('Email transporter configuration error:', error);
      } else {
        console.log('Email transporter ready – SMTP connection verified');
      }
    });
  } else {
    console.warn('Email transporter not configured; emails will be skipped.');
  }
}

module.exports = sendEmail;
