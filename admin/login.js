// public/admin/login.js
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const msg = document.getElementById('msg');
  const err = document.getElementById('err');

  // Pre-fill email for convenience during development (remove in production if desired)
  if (emailInput && !emailInput.value) {
    emailInput.value = 'admin@karumande.sc.ke';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Reset messages
    msg.style.display = 'block';
    err.style.display = 'none';
    err.textContent = '';

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Please enter both email and password');
      return;
    }

    // Disable button during request
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Success! Save token and redirect
      localStorage.setItem('token', data.token);

      // Optional: Save user info
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      // Redirect to dashboard
      window.location.href = '/admin/dashboard.html';

    } catch (error) {
      showError(error.message || 'Invalid email or password');
      console.error('Login error:', error);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });

  function showError(message) {
    msg.style.display = 'none';
    err.style.display = 'block';
    err.textContent = message;
  }
});