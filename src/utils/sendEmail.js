// utils/sendEmail.js
const nodemailer = require('nodemailer');

const EMAIL_USER = process.env.EMAIL_USER?.trim() || process.env.BREVO_EMAIL?.trim() || '';
const rawPass = process.env.EMAIL_APP_PASSWORD || process.env.BREVO_SMTP_KEY || '';
const EMAIL_APP_PASSWORD = rawPass ? String(rawPass).trim().replace(/\s+/g, '') : '';
const EMAIL_SMTP_HOST = process.env.EMAIL_SMTP_HOST?.trim() || 'smtp.gmail.com';
const EMAIL_SMTP_PORT = process.env.EMAIL_SMTP_PORT ? Number(process.env.EMAIL_SMTP_PORT) : 465;
const EMAIL_SMTP_SECURE = process.env.EMAIL_SMTP_SECURE ? process.env.EMAIL_SMTP_SECURE === 'true' : true;

const createTransporter = () => {
  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {
    console.warn('Email configuration incomplete: no valid SMTP credentials found. Email sending is disabled.');
    return null;
  }

  return nodemailer.createTransport({
    host: EMAIL_SMTP_HOST,
    port: EMAIL_SMTP_PORT,
    secure: EMAIL_SMTP_SECURE,
    auth: { user: EMAIL_USER, pass: EMAIL_APP_PASSWORD },
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

const sendEmail = async ({ to, subject, html, text, replyTo }) => {
  const trimmedTo = String(to || '').trim();
  const trimmedSubject = String(subject || '').trim();
  const trimmedHtml = String(html || '').trim();

  if (!trimmedTo || !trimmedSubject || !trimmedHtml) {
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
      address: EMAIL_USER,
    },
    to: trimmedTo,
    subject: trimmedSubject,
    html: trimmedHtml,
    text: text?.trim(),
    ...(replyTo ? { replyTo: replyTo.trim() } : {}),
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
    return { success: false, error: error.message };
  }
};

// Verify transporter on startup
if (process.env.NODE_ENV !== 'test') {
  if (transporter) {
    transporter.verify((error) => {
      if (error) {
        console.error('Email transporter configuration error:', error, {
          host: EMAIL_SMTP_HOST,
          port: EMAIL_SMTP_PORT,
          secure: EMAIL_SMTP_SECURE,
          hint:
            error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED'
              ? 'Cannot reach SMTP (firewall, wrong host/port, or blocked outbound). Try EMAIL_SMTP_PORT=587 and EMAIL_SMTP_SECURE=false for STARTTLS, or allow outbound SMTP from this network.'
              : undefined,
        });
      } else {
        console.log('Email transporter ready – SMTP connection verified');
      }
    });
  } else {
    console.warn('Email transporter not configured; emails will be skipped.');
  }
}

module.exports = sendEmail;
