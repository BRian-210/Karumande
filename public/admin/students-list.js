const token = localStorage.getItem('token');
if (!token) window.location.href = '/login.html';

const elements = {
  logoutBtn: document.getElementById('logoutBtn'),
  body: document.getElementById('studentsBody'),
  search: document.getElementById('search'),
  searchBtn: document.getElementById('searchBtn')
};

// Logout
elements.logoutBtn?.addEventListener('click', () => {
  localStorage.removeItem('token');
  window.location.href = '/login.html';
});

// Load students
async function loadStudents(query = '') {
  try {
    const url = query ? `/api/students?search=${encodeURIComponent(query)}` : '/api/students';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to load students');
    const data = await res.json();
    renderStudents(data.data || data); // support both paginated and plain arrays
  } catch (err) {
    console.error(err);
    elements.body.innerHTML = `<tr><td colspan="5" style="color:red;text-align:center;">${err.message}</td></tr>`;
  }
}

// Render students
function renderStudents(students) {
  if (!students.length) {
    elements.body.innerHTML = `<tr><td colspan="5" style="text-align:center;">No students found</td></tr>`;
    return;
  }
  elements.body.innerHTML = students.map(s => `
    <tr>
      <td>${s.admissionNumber || 'N/A'}</td>
      <td>${s.name}</td>
      <td>${s.classLevel}</td>
      <td>${s.parent?.name || 'N/A'}</td>
      <td><button class="view-btn" data-id="${s._id}">👁️ View</button></td>
    </tr>
  `).join('');

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      window.open(`/admin/student-profile.html?id=${id}`, '_blank');
    });
  });
}

// Search
elements.searchBtn?.addEventListener('click', () => {
  const q = elements.search.value.trim();
  loadStudents(q);
});

// Initial load
loadStudents();