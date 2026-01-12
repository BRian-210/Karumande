const API_BASE = '';
const form = document.getElementById('loginForm');
const errEl = document.getElementById('err');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errEl.style.display = 'none';
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const body = await res.json().catch(()=>({}));
      throw new Error(body.message || 'Login failed');
    }

    const data = await res.json();
    // store token and redirect
    localStorage.setItem('token', data.token);
    window.location.href = '/teachers/dashboard.html';
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

