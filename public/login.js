// /login.js - Updated (January 2026)
// Restricted redirects to student & parent only

(function() {
  'use strict';

  // Use relative path for API (works in dev & production with proxy)
  const API_BASE = '/api';

  // Redirect if already logged in
  const token = localStorage.getItem('token');
  if (token) {
    validateTokenAndRedirect(token);
    return;
  }

  // DOM elements
  const els = {
    form: document.getElementById('loginForm'),
    error: document.getElementById('error'),
    btn: document.getElementById('loginBtn'),
    btnText: document.getElementById('loginText'),
    loadingText: document.getElementById('loadingText'),
    identifier: document.getElementById('admissionNo'),
    password: document.getElementById('password')
  };

  if (!els.form || !els.identifier || !els.password) {
    console.error('Critical login form elements missing');
    if (els.error) {
      els.error.textContent = 'Login form error – missing fields';
      els.error.style.display = 'block';
    }
    return;
  }

  function showError(msg) {
    if (els.error) {
      els.error.textContent = msg;
      els.error.style.display = 'block';
    }
    console.error('Login error:', msg);
  }

  function setLoading(isLoading) {
    if (els.btn) els.btn.disabled = isLoading;
    if (els.btnText) els.btnText.style.display = isLoading ? 'none' : 'inline';
    if (els.loadingText) els.loadingText.style.display = isLoading ? 'inline' : 'none';
  }

  async function validateTokenAndRedirect(token) {
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error('Invalid token');

      const { user } = await res.json();
      redirectByRole(user.role);
    } catch (err) {
      console.warn('Token invalid/expired:', err.message);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }

  // ────────────────────────────────────────────────
  // Only student and parent are redirected to dashboard
  // Teacher/admin/unknown roles get error message
  // ────────────────────────────────────────────────
  function redirectByRole(role) {
    const roleLower = (role || '').toLowerCase();

    const allowed = {
      'student': '/parents/students-dashboard.html',
      'parent':  '/parents/students-dashboard.html'
    };

    const target = allowed[roleLower];

    if (target) {
      console.log(`Redirecting ${role} → ${target}`);
      window.location.href = target;
    } else {
      console.warn(`Unauthorized role for this portal: ${role || 'unknown'}`);
      showError(
        'This login portal is only for parents and students. ' +
        'If you are a teacher or admin, please use the appropriate dashboard.'
      );
    }
  }

  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const identifier = els.identifier.value.trim();
    const password = els.password.value;

    if (!identifier || !password) {
      showError('Please enter your email / admission number and password');
      return;
    }

    setLoading(true);
    if (els.error) els.error.style.display = 'none';

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed – check your credentials');
      }

      // Success – store auth data
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Optional: force password change if required
      if (data.user.mustChangePassword) {
        window.location.href = '/change-password.html';
        return;
      }

      // Only student/parent proceed to dashboard
      redirectByRole(data.user.role);

    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  });

  // Auto-focus first field
  els.identifier?.focus();

  console.log('Login script initialized – student/parent portal only');
})();