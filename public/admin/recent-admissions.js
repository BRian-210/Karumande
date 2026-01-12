// public/admin/recent-admissions.js
// Extracted from recent-admissions.html to comply with CSP (no inline scripts)

const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/admin/login.html';
}

// backend mounts admissions routes at /api/admissions
const API = '/api/admissions/recent';
const loading = document.getElementById('loading');
const table = document.getElementById('recentTable');
const body = document.getElementById('recentBody');
const emptyMsg = document.getElementById('emptyMsg');

function fmtDate(s){ try { return new Date(s).toLocaleString(); } catch(e){ return s } }

async function loadRecent(){
  loading.style.display = 'block'; table.style.display='none'; emptyMsg.style.display='none';
  // Provide a fetch timeout and a slow-loader indicator for long responses
  const controller = new AbortController();
  const signal = controller.signal;
  const slowTimer = setTimeout(() => {
    loading.innerHTML = '<i class="fa-solid fa-hourglass-half"></i> Taking longer than usual...';
  }, 3000);

  // Abort after 10s
  const timeout = setTimeout(() => controller.abort(), 10000);

  try{
    const res = await fetch(API, { headers: { 'Authorization': `Bearer ${token}` }, signal });
    if (res.status === 401 || res.status === 403) {
      // not authorized — go to login
      localStorage.removeItem('token');
      window.location.href = '/admin/login.html';
      return;
    }
    if (!res.ok) throw new Error('Failed to load recent admissions');
    const items = await res.json();
    body.innerHTML = '';
    if (!items || items.length === 0) {
      emptyMsg.style.display = 'block';
      return;
    }

    items.forEach(a => {
      const tr = document.createElement('tr');
      const admNo = a.admissionNumber || '-';
      const student = (a.student && (a.student.name || a.student._id)) ? (a.student.name || a.student._id) : '-';
      const parentEmail = a.email || '-';
      const phone = a.phone || '-';
      const cls = (a.student && a.student.classLevel) || a.classApplied || '-';
      const created = a.submittedAt || a.updatedAt || a.createdAt || '-';
      const status = (a.status || '-').toLowerCase();

      tr.innerHTML = `
        <td><strong>${admNo}</strong></td>
        <td>${student || '-'}</td>
        <td>${parentEmail}</td>
        <td>${phone}</td>
        <td>${cls}</td>
        <td>${fmtDate(created)}</td>
        <td><span class="status ${status}">${status}</span></td>
        <td class="actions">
          ${a.student && a.student._id ? `<a href="/admin/students.html?id=${a.student._id}">View Student</a>` : '<span class="small">-</span>'}
        </td>
      `;
      body.appendChild(tr);
    });

    table.style.display = 'table';
  } catch (err) {
    console.error('Load recent admissions error', err);
    if (err.name === 'AbortError') {
      loading.innerHTML = '<div class="small">Request timed out. Try refreshing the page.</div>';
    } else {
      emptyMsg.style.display = 'block';
    }
  } finally {
    clearTimeout(timeout);
    clearTimeout(slowTimer);
    loading.style.display = 'none';
  }
}

loadRecent();
