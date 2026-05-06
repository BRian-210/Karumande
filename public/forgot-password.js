// forgot-password.js

const form = document.getElementById('forgotPasswordForm');
const msg = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');
const emailInput = document.getElementById('email');

form.addEventListener('submit', async e => {
  e.preventDefault();
  
  // Reset message
  msg.textContent = '';
  msg.className = 'message';

  const email = emailInput.value.trim();

  if (!email) {
    msg.textContent = "Please enter your email address.";
    msg.className = 'message error';
    emailInput.focus();
    return;
  }

  // Basic email validation
  if (!email.includes('@') || !email.includes('.')) {
    msg.textContent = "Please enter a valid email address.";
    msg.className = 'message error';
    emailInput.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Sending...";
  msg.textContent = "Sending reset link...";
  msg.className = 'message';

  try {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();

    if (res.ok) {
      msg.textContent = "✅ Reset link has been sent to your email. Please check your inbox (and spam folder).";
      msg.className = 'message success';
      form.reset();
      
      // Optional: Disable form after success
      emailInput.disabled = true;
    } else {
      msg.textContent = data.message || "Failed to send reset link. Please try again.";
      msg.className = 'message error';
    }
  } catch (err) {
    console.error('Forgot password error:', err);
    msg.textContent = "Network error. Please check your internet connection and try again.";
    msg.className = 'message error';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Send Reset Link";
  }
});