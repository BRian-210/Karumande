const express = require('express');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();

const validateEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

router.post('/', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const message = String(req.body.message || '').trim();

  if (!name || !email || !message) {
    return res.status(400).json({ message: 'Please provide your name, email address, and message.' });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'githinjibriank973@gmail.com';
  const subject = `New enquiry from ${name}`;
  const html = `
    <h2>New website contact enquiry</h2>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Message:</strong></p>
    <p>${message.replace(/\n/g, '<br>')}</p>
    <hr />
    <p>This message was submitted from the Karumande Link School website contact form.</p>
  `;
  const text = `New website contact enquiry\n\nName: ${name}\nEmail: ${email}\n\nMessage:\n${message}`;

  const emailResult = await sendEmail({
    to: adminEmail,
    subject,
    html,
    text,
    replyTo: email,
  });

  if (!emailResult.success) {
    return res.status(500).json({ message: 'Unable to send your message. Please try again later.' });
  }

  return res.json({ message: 'Thank you! Your enquiry has been sent successfully.' });
});

module.exports = router;
