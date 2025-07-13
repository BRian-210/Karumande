const form = document.getElementById('student-form');
const message = document.getElementById('message');
const modal = document.getElementById('success-modal');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const studentClass = document.getElementById('class').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim(); // ✅ new

  if (!name || !studentClass || !email || !password) {
    message.textContent = 'Please fill in all fields.';
    message.style.color = 'red';
    return;
  }

  if (password.length < 4) {
    message.textContent = 'Password must be at least 4 characters.';
    message.style.color = 'red';
    return;
  }

try {
  const res = await fetch("https://karumande-api.onrender.com/api/students", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, class: studentClass, email, password })
  });

  const data = await res.json();

  if (!res.ok) {
    message.textContent = data.message || 'Something went wrong.';
    message.style.color = 'red';
  } else {
    message.textContent = '';
    modal.classList.remove('hidden');
    form.reset();
  }
} catch (error) {
  message.textContent = 'Error connecting to server.';
  message.style.color = 'red';
}


function closeModal() {
  modal.classList.add('hidden');
}

// Highlight nav link
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.includes('index.html')) {
    document.getElementById('home-link')?.classList.add('active');
  } else if (path.includes('register.html')) {
    document.getElementById('register-link')?.classList.add('active');
  }

  // Burger menu
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav-links');
  if (burger && nav) {
    burger.addEventListener('click', () => {
      nav.classList.toggle('show');
    });
  }
});
