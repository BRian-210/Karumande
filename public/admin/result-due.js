const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
if (!token) {
  window.location.href = '/admin/login.html';
}

function logout() {
  if (confirm('Log out of Admin Panel?')) {
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login.html';
  }
}

// Mobile menu toggle
document.getElementById('mobileToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// Load existing due dates
async function loadDueDates() {
  try {
    const res = await fetch('/api/teachers/result-due', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load due dates');
    const dueDates = await res.json();
    renderDueDates(dueDates);
  } catch (err) {
    document.getElementById('dueDatesBody').innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:40px;color:var(--danger);">
          <i class="fa-solid fa-exclamation-triangle"></i> Error: ${err.message}
        </td>
      </tr>
    `;
  }
}

function renderDueDates(dueDates) {
  const tbody = document.getElementById('dueDatesBody');
  if (!dueDates || dueDates.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:40px;color:var(--muted);">
          No due dates set yet. Create one above.
        </td>
      </tr>
    `;
    return;
  }

  const now = new Date();
  tbody.innerHTML = dueDates.map(dd => {
    const dueDate = new Date(dd.dueDate);
    const isPast = dueDate < now;
    const status = isPast
      ? '<span style="color:var(--danger);font-weight:600;"><i class="fa-solid fa-lock"></i> Past Due</span>'
      : '<span style="color:var(--success);font-weight:600;"><i class="fa-solid fa-clock"></i> Active</span>';

    return `
      <tr>
        <td><strong>${dd.classLevel || 'All Classes'}</strong></td>
        <td>${dd.term}</td>
        <td>${dd.subject || '<em>All Subjects</em>'}</td>
        <td>${dueDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
        <td>${status}</td>
        <td>
          <button class="delete-due-btn btn" data-id="${dd._id}" style="background:var(--danger);color:white;padding:6px 12px;font-size:0.85rem;">
            <i class="fa-solid fa-trash"></i> Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');

  // Attach delete handlers
  document.querySelectorAll('.delete-due-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this due date? Teachers will be able to submit results again.')) return;
      const id = btn.dataset.id;
      try {
        const res = await fetch(`/api/teachers/result-due/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete due date');
        loadDueDates(); // Refresh the list
      } catch (err) {
        alert('Error deleting due date: ' + err.message);
      }
    });
  });
}

// Form submit
document.getElementById('dueDateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('formMessage');

  const payload = {
    classLevel: document.getElementById('classLevel').value || undefined,
    term: document.getElementById('term').value,
    subject: document.getElementById('subject').value.trim() || undefined,
    dueDate: new Date(document.getElementById('dueDate').value).toISOString()
  };

  try {
    msgEl.style.display = 'block';
    msgEl.style.cssText += 'background:#fef3c7;border:2px solid #f59e0b;color:#92400e;padding:12px;border-radius:8px;';
    msgEl.textContent = 'Saving...';

    const res = await fetch('/api/teachers/result-due', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to save due date');
    }

    msgEl.style.cssText = 'background:#d1fae5;border:2px solid #10b981;color:#065f46;padding:12px;border-radius:8px;margin-top:16px;display:block;';
    msgEl.textContent = 'Due date saved successfully!';

    document.getElementById('dueDateForm').reset();
    loadDueDates();

    setTimeout(() => msgEl.style.display = 'none', 3000);
  } catch (err) {
    msgEl.style.cssText = 'background:#fee2e2;border:2px solid #ef4444;color:#991b1b;padding:12px;border-radius:8px;margin-top:16px;display:block;';
    msgEl.textContent = `Error: ${err.message}`;
  }
});

document.getElementById('refreshBtn').addEventListener('click', loadDueDates);

// Initial load
loadDueDates();