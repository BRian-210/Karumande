const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
if (!token) window.location.href = '/admin/login.html';

function logout() {
  if (confirm('Log out of Admin Panel?')) {
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminName');
    window.location.href = '/admin/login.html';
  }
}

// Mobile menu toggle
document.getElementById('mobileToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

const elements = {
  form: document.getElementById('announcementForm'),
  title: document.getElementById('title'),
  body: document.getElementById('body'),
  audience: document.getElementById('audience'),
  logoutBtn: document.getElementById('logoutBtn'),
  tableBody: document.getElementById('announcementsBody')
};

// Logout button
elements.logoutBtn?.addEventListener('click', logout);

// Load announcements
async function loadAnnouncements() {
  try {
    const res = await fetch('/api/announcements?limit=50', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load announcements');
    const data = await res.json();
    renderAnnouncements(data.data || []);
  } catch (err) {
    console.error(err);
    elements.tableBody.innerHTML = `<tr><td colspan="4" style="color:red;text-align:center;">${err.message}</td></tr>`;
  }
}

// Render announcements
function renderAnnouncements(items) {
  if (!items.length) {
    elements.tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No announcements found</td></tr>`;
    return;
  }
  elements.tableBody.innerHTML = items.map(a => `
    <tr>
      <td><strong>${a.title}</strong></td>
      <td>${a.body.substring(0, 100)}...</td>
      <td>${new Date(a.createdAt).toLocaleString()}</td>
      <td>
        <button data-id="${a._id}" class="delete-btn btn outline" style="padding: 6px 12px; font-size: 0.85rem;">
          <i class="fa-solid fa-trash"></i> Delete
        </button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('Delete this announcement?')) {
        try {
          const res = await fetch(`/api/announcements/${btn.dataset.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Failed to delete announcement');
          loadAnnouncements();
        } catch (err) {
          alert(`Error: ${err.message}`);
        }
      }
    });
  });
}

// Submit new announcement
elements.form?.addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const submitBtn = elements.form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Publishing...';

    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        title: elements.title.value,
        body: elements.body.value,
        audience: elements.audience.value
      })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to publish announcement');
    }
    
    elements.title.value = '';
    elements.body.value = '';
    elements.audience.value = 'public';
    alert('Announcement published successfully!');
    loadAnnouncements();
  } catch (err) {
    console.error(err);
    alert(`Error: ${err.message}`);
  } finally {
    const submitBtn = elements.form.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publish Announcement';
  }
});

// Initial load
loadAnnouncements();