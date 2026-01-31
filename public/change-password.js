// Show/hide password toggles
document.querySelectorAll('.toggle-password').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.previousElementSibling;
    const type = input.type === 'password' ? 'text' : 'password';
    input.type = type;
    btn.textContent = type === 'text' ? '🙈' : '👁️';
  });
});

const form = document.getElementById('changePasswordForm');
const msg = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');

form.addEventListener('submit', async e => {
  e.preventDefault();
  msg.className = 'message';
  msg.textContent = '';

  const current = document.getElementById('currentPassword').value;
  const newPwd  = document.getElementById('newPassword').value;
  const confirm = document.getElementById('confirmPassword').value;

  if (newPwd !== confirm) {
    msg.textContent = "New passwords don't match.";
    msg.className = 'message error';
    return;
  }

  if (newPwd.length < 10 ||
      !/[A-Z]/.test(newPwd) ||
      !/[a-z]/.test(newPwd) ||
      !/[0-9]/.test(newPwd) ||
      !/[^A-Za-z0-9\s]/.test(newPwd)) {
    msg.textContent = "Password must be at least 10 characters and include uppercase, lowercase, number, and special character.";
    msg.className = 'message error';
    return;
  }

  if (newPwd === current) {
    msg.textContent = "New password must be different from current password.";
    msg.className = 'message error';
    return;
  }

  submitBtn.disabled = true;
  msg.textContent = "Updating password...";
  msg.className = 'message';

  try {
    const token = localStorage.getItem('token');

    if (!token) {
      msg.textContent = "You are not logged in. Redirecting to login...";
      msg.className = 'message error';
      setTimeout(() => {
        window.location.href = '/login.html'; // ← adjust path to your login page
      }, 1800);
      return;
    }

    // Optional: log for debugging (remove later)
    console.log('Sending change-password request with token:', token.substring(0, 20) + '...');

    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      credentials: 'include',  // keep only if you're also using cookies/sessions
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`   // ← this fixes the 401
      },
      body: JSON.stringify({
        currentPassword: current,
        newPassword: newPwd
      })
    });

    const data = await res.json();

    if (res.ok) {
      msg.textContent = "Password updated successfully! Redirecting...";
      msg.className = 'message success';
      
      // Optional: clear sensitive fields
      document.getElementById('currentPassword').value = '';
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmPassword').value = '';

      setTimeout(() => {
        window.location.href = '/student-dashboard.html';
      }, 1800);
    } else {
      // Handle common auth errors more clearly
      if (res.status === 401) {
        msg.textContent = data.message || "Session expired or invalid. Please log in again.";
        localStorage.removeItem('token'); // clean up bad token
        setTimeout(() => {
          window.location.href = '/login.html'; // ← adjust path
        }, 2200);
      } else if (res.status === 400) {
        msg.textContent = data.message || data.errors?.[0]?.msg || "Invalid input.";
      } else {
        msg.textContent = data.message || "Could not update password. Please try again.";
      }
      msg.className = 'message error';
    }
  } catch (err) {
    console.error('Change password fetch error:', err);
    msg.textContent = "Connection error. Please check your network and try again.";
    msg.className = 'message error';
  } finally {
    submitBtn.disabled = false;
  }
});