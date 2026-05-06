// Toggle password visibility
document.querySelectorAll('.toggle-password').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.previousElementSibling;
    const type = input.type === 'password' ? 'text' : 'password';
    input.type = type;
    btn.textContent = type === 'text' ? '🙈' : '👁️';
  });
});

const form = document.getElementById('resetPasswordForm');
const msg = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');

form.addEventListener('submit', async e => {
  e.preventDefault();
  
  msg.textContent = '';
  msg.className = 'message';

  const newPassword = document.getElementById('newPassword').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();
  const token = new URLSearchParams(window.location.search).get('token');

  // Debug logging
  console.log('Token from URL:', token ? token.substring(0, 15) + '...' : 'MISSING');
  console.log('New Password Length:', newPassword.length);

  if (!token) {
    msg.textContent = "Invalid or expired reset link. Please request a new one.";
    msg.className = 'message error';
    return;
  }

  if (newPassword !== confirmPassword) {
    msg.textContent = "Passwords do not match.";
    msg.className = 'message error';
    return;
  }

  if (newPassword.length < 8) {
    msg.textContent = "Password must be at least 8 characters long.";
    msg.className = 'message error';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Resetting...";
  msg.textContent = "Resetting your password...";
  msg.className = 'message';

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        token, 
        newPassword 
      })
    });

    const data = await res.json();

    console.log('Server Response:', res.status, data);   // ← Debug

    if (res.ok) {
      msg.textContent = "✅ Password reset successful! Redirecting to login...";
      msg.className = 'message success';

      setTimeout(() => {
        window.location.href = '/login.html';
      }, 2000);
    } else {
      msg.textContent = data.message || "Failed to reset password.";
      msg.className = 'message error';
    }
  } catch (err) {
    console.error('Reset password error:', err);
    msg.textContent = "Network error. Please try again.";
    msg.className = 'message error';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Reset Password";
  }
});