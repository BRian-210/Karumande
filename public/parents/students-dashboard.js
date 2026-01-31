// /parents/students-dashboard.js

const API_BASE = '/api';  // change to full URL in production if needed: 'https://karumande.onrender.com/api'

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  if (!token) {
    showMessage('Session expired. Please log in again.', 'error');
    setTimeout(() => window.location.href = '/login.html', 2000);
    return null;
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (res.status === 401) {
      localStorage.removeItem('token');
      showMessage('Session expired. Redirecting to login...', 'error');
      setTimeout(() => window.location.href = '/login.html', 2000);
      return null;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error(`API error (${endpoint}):`, err);
    showMessage(`Failed to load data: ${err.message}`, 'error');
    return null;
  }
}

function showMessage(text, type = 'info') {
  const msgEl = document.createElement('div');
  msgEl.className = `message ${type}`;
  msgEl.textContent = text;
  document.querySelector('.container')?.prepend(msgEl);
  setTimeout(() => msgEl.remove(), 8000);
}

function logout() {
  localStorage.removeItem('token');
  window.location.href = '/login.html';
}

// Format KES with commas
function formatKES(amount) {
  return amount?.toLocaleString('en-KE') || '—';
}

document.addEventListener('DOMContentLoaded', async () => {
  // ─── 1. Get list of children ───────────────────────────────────────
  const childrenRes = await apiFetch('/student?parent=true');  // using your existing /student? route filtered by parent

  let children = [];
  if (childrenRes?.data) {
    children = childrenRes.data;
  }

  if (!children.length) {
    showMessage('No students linked to your account. Contact school admin.', 'error');
    return;
  }

  // ─── 2. If multiple children → show selector ────────────────────────
  const selector = document.getElementById('childSelector');
  const select = document.getElementById('childSelect');

  if (children.length > 1) {
    selector.style.display = 'block';
    children.forEach(child => {
      const opt = document.createElement('option');
      opt.value = child._id;
      opt.textContent = `${child.name} (${child.classLevel || child.grade || '?'}${child.stream ? ' - ' + child.stream : ''})`;
      select.appendChild(opt);
    });
  }

  // Default to first child
  let selectedId = children[0]._id;

  // ─── 3. Load dashboard data for selected child ──────────────────────
  async function loadDashboard(studentId) {
    const data = await apiFetch(`/student/dashboard/${studentId}`);

    if (!data?.success) {
      showMessage('Failed to load student dashboard.', 'error');
      return;
    }

    const s = data.student;

    // Basic info
    document.getElementById('studentName').textContent     = s.name || '—';
    document.getElementById('studentClass').textContent    = [s.classLevel, s.stream].filter(Boolean).join(' - ') || '—';
    document.getElementById('studentAdmission').textContent = s.admissionNumber || '—';

    // Fee summary
    const fs = data.fees.summary;
    document.getElementById('feeBalance').textContent = `KES ${formatKES(fs.balance)}`;

    const statusEl = document.getElementById('feeStatus');
    statusEl.textContent = fs.status?.toUpperCase() || '—';
    statusEl.className = `badge ${fs.status || 'unknown'}`;

    // Show/hide payment section
    document.getElementById('paymentSection').style.display = 
      fs.balance > 0 ? 'block' : 'none';

    // Fees table
    const feesTbody = document.getElementById('feesTableBody');
    feesTbody.innerHTML = '';

    if (data.fees.recentBills?.length > 0) {
      data.fees.recentBills.forEach(b => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${b.term || '—'}</td>
          <td>KES ${formatKES(b.amount)}</td>
          <td>—</td> <!-- paid column not directly available -->
          <td>KES ${formatKES(data.fees.summary.balance)}</td>
          <td><span class="badge ${data.fees.summary.status}">${data.fees.summary.status?.toUpperCase() || '—'}</span></td>
        `;
        feesTbody.appendChild(row);
      });
    } else {
      feesTbody.innerHTML = '<tr><td colspan="5" class="text-center">No fee records found</td></tr>';
    }

    // Results table
    const resultsTbody = document.getElementById('resultsTableBody');
    resultsTbody.innerHTML = '';

    if (data.results?.length > 0) {
      data.results.forEach(r => {
        const row = document.createElement('tr');
        // Adjust according to your actual Result schema
        row.innerHTML = `
          <td>${r.term || r.year || '—'}</td>
          <td>${r.subjects?.[0]?.subject || 'Multiple subjects'}</td>
          <td>${r.total || '—'}</td>
          <td>${r.grade || '—'}</td>
          <td>${r.remarks || '—'}</td>
        `;
        resultsTbody.appendChild(row);
      });
    } else {
      resultsTbody.innerHTML = '<tr><td colspan="5" class="text-center">No recent results</td></tr>';
    }

    // Optional: announcements (if you have this endpoint)
    // const ann = await apiFetch('/announcements');
    // ... populate if exists
  }

  // Initial load
  await loadDashboard(selectedId);

  // Reload when user changes child
  select?.addEventListener('change', e => {
    selectedId = e.target.value;
    loadDashboard(selectedId);
  });
});