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
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',           // ← important if using cookies/JWT in cookie
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: current,
          newPassword: newPwd
        })
      });

      const data = await res.json();

      if (res.ok) {
        msg.textContent = "Password updated successfully! Redirecting...";
        msg.className = 'message success';
        setTimeout(() => {
          window.location.href = '/parents/students-dashboard.html';
        }, 1800);
      } else {
        msg.textContent = data.error || "Could not update password. Please try again.";
        msg.className = 'message error';
      }
    } catch (err) {
      msg.textContent = "Connection error. Please check your network.";
      msg.className = 'message error';
    } finally {
      submitBtn.disabled = false;
    }
  });