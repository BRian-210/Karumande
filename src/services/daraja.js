const crypto = require('crypto');

function resolveBaseUrl() {
  return process.env.MPESA_ENV === 'live'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

async function getAccessToken() {
  const key = process.env.DARAJA_CONSUMER_KEY;
  const secret = process.env.DARAJA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error('Missing Daraja credentials');
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const url = `${resolveBaseUrl()}/oauth/v1/generate?grant_type=client_credentials`;
  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` }
  });
  if (!res.ok) throw new Error(`Token request failed (${res.status})`);
  const data = await res.json();
  return data.access_token;
}

function buildPassword(shortCode, passKey, timestamp) {
  return Buffer.from(`${shortCode}${passKey}${timestamp}`).toString('base64');
}

async function stkPush({ phone, amount, accountReference, description, callbackUrl }) {
  const shortCode = process.env.DARAJA_SHORT_CODE;
  const passKey = process.env.DARAJA_PASSKEY;
  if (!shortCode || !passKey) throw new Error('Missing DARAJA_SHORT_CODE or DARAJA_PASSKEY');

  const token = await getAccessToken();
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14); // YYYYMMDDHHMMSS
  const password = buildPassword(shortCode, passKey, timestamp);

  const payload = {
    BusinessShortCode: shortCode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Number(amount),
    PartyA: phone,
    PartyB: shortCode,
    PhoneNumber: phone,
    CallBackURL: callbackUrl || process.env.DARAJA_CALLBACK_URL,
    AccountReference: accountReference || 'KARUMANDE',
    TransactionDesc: description || 'Fees'
  };

  const res = await fetch(`${resolveBaseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!res.ok || data.ResponseCode !== '0') {
    throw new Error(data.errorMessage || data.errorCode || 'STK push failed');
  }
  return data; // Contains MerchantRequestID, CheckoutRequestID, ResponseDescription
}

function isIpAllowed(req) {
  const allow = process.env.DARAJA_ALLOWED_IPS;
  if (!allow) return true;
  const ips = allow.split(',').map((ip) => ip.trim()).filter(Boolean);
  if (!ips.length) return true;
  const source =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.connection?.remoteAddress ||
    req.ip;
  return ips.includes(source);
}

function normalizePhone(msisdn) {
  if (!msisdn) return msisdn;
  const digits = msisdn.replace(/\D/g, '');
  if (digits.startsWith('0')) return `254${digits.slice(1)}`;
  if (digits.startsWith('254')) return digits;
  if (digits.startsWith('2540')) return digits.replace(/^2540/, '254');
  if (digits.startsWith('7') && digits.length === 9) return `254${digits}`;
  return digits;
}

function validateSignature(rawBody, providedSignature) {
  const secret = process.env.DARAJA_CALLBACK_SECRET;
  if (!secret) return true; // signature check disabled
  if (!rawBody || !providedSignature) return false;
  const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return computed === providedSignature;
}

module.exports = { stkPush, isIpAllowed, normalizePhone, validateSignature };

