// public/admin/admissions.js
// Updated version – January 2026

const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/admin/login.html';
}

const API_BASE = '';
const tbody = document.getElementById('applicationsBody');
const table = document.getElementById('applicationsTable');
const loading = document.getElementById('loading');
const empty = document.getElementById('empty');
const statusFilter = document.getElementById('statusFilter');

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

async function loadApplications(status = 'pending') {
  try {
    loading.style.display = 'block';
    table.style.display = 'none';
    empty.style.display = 'none';

    const url = status === 'all'
      ? `${API_BASE}/api/admissions`
      : `${API_BASE}/api/admissions?status=${status}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Failed to load applications');

    const data = await res.json();
    const apps = Array.isArray(data) ? data : (data.applications || []);

    tbody.innerHTML = '';

    if (!apps || apps.length === 0) {
      empty.style.display = 'block';
      return;
    }

    apps.forEach(app => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${app.studentName}</strong></td>
        <td>${app.parentName}<br><small>${app.email || '-'}</small></td>
        <td>${app.phone}</td>
        <td>${app.classApplied}</td>
        <td>${formatDate(app.submittedAt)}</td>
        <td><span class="status ${app.status}">${app.status}</span></td>
        <td class="actions">
          <button class="btn btn-view" data-id="${app._id}" data-action="view">
            <i class="fa-solid fa-eye"></i> View
          </button>
          ${app.status === 'pending' ? `
            <button class="btn btn-approve" data-id="${app._id}" data-action="accept">
              <i class="fa-solid fa-check"></i> Approve
            </button>
            <button class="btn btn-reject" data-id="${app._id}" data-action="reject">
              <i class="fa-solid fa-times"></i> Reject
            </button>
          ` : '<em>Processed</em>'}
        </td>
      `;
      tbody.appendChild(row);
    });

    table.style.display = 'table';

    // ✅ Attach action handlers after rendering
    tbody.querySelectorAll('button[data-action]').forEach(btn => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;

      if (action === 'view') {
        btn.addEventListener('click', () => viewApplication(id));
      } else if (action === 'accept') {
        btn.addEventListener('click', () => updateStatus(id, 'accepted'));
      } else if (action === 'reject') {
        btn.addEventListener('click', () => updateStatus(id, 'rejected'));
      }
    });

  } catch (err) {
    alert('Error loading applications: ' + err.message);
  } finally {
    loading.style.display = 'none';
  }
}

async function updateStatus(id, newStatus) {
  const action = newStatus === 'accepted' ? 'approve' : 'reject';
  if (!confirm(`Are you sure you want to ${action} this application?`)) return;

  try {
    const res = await fetch(`${API_BASE}/api/admissions/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: newStatus })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Update failed');
    }

    alert(`Application ${action}d successfully!`);
    loadApplications(statusFilter.value);
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function viewApplication(id) {
  window.location.href = `/admin/admission-view.html?id=${id}`;
}

// Filter change
statusFilter.addEventListener('change', (e) => {
  const status = e.target.value === 'all' ? 'all' : e.target.value;
  loadApplications(status);
});

// Initial load
loadApplications('pending');