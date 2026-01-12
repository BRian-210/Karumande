const token = localStorage.getItem('token');
if (!token) window.location.href = '/login.html';

const elements = {
  form: document.getElementById('announcementForm'),
  title: document.getElementById('title'),
  message: document.getElementById('message'),
  logoutBtn: document.getElementById('logoutBtn'),
  body: document.getElementById('announcementsBody')
};

// Logout
elements.logoutBtn?.addEventListener('click', () => {
  localStorage.removeItem('token');
  window.location.href = '/login.html';
});

// Load announcements
async function loadAnnouncements() {
  try {
    const res = await fetch('/api/announcements', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load announcements');
    const data = await res.json();
    renderAnnouncements(data);
  } catch (err) {
    console.error(err);
    elements.body.innerHTML = `<tr><td colspan="4" style="color:red;text-align:center;">${err.message}</td></tr>`;
  }
}

// Render announcements
function renderAnnouncements(items) {
  if (!items.length) {
    elements.body.innerHTML = `<tr><td colspan="4" style="text-align:center;">No announcements found</td></tr>`;
    return;
  }
  elements.body.innerHTML = items.map(a => `
    <tr>
      <td>${a.title}</td>
      <td>${a.message}</td>
      <td>${new Date(a.createdAt).toLocaleString()}</td>
      <td><button data-id="${a._id}" class="delete-btn">🗑️ Delete</button></td>
    </tr>
  `).join('');

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this announcement?')) {
        await fetch(`/api/announcements/${btn.dataset.id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        loadAnnouncements();
      }
    });
  });
}

// Submit new announcement
elements.form?.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: elements.title.value,
        message: elements.message.value
      })
    });
    if (!res.ok) throw new Error('Failed to publish announcement');
    elements.title.value = '';
    elements.message.value = '';
    loadAnnouncements();
  } catch (err) {
    alert(err.message);
  }
});

// Initial load
loadAnnouncements();