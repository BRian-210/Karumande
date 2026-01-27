const token = localStorage.getItem('token');
if (!token) window.location.href = '/admin/login.html';

const elements = {
  logoutBtn: document.getElementById('logoutBtn'),
  body: document.getElementById('studentsBody'),
  search: document.getElementById('search'),
  searchBtn: document.getElementById('searchBtn')
};

// Logout
elements.logoutBtn?.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('adminToken'); // backwards-compat
  window.location.href = '/admin/login.html';
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

// Render students grouped by class
function renderStudents(students) {
  if (!students.length) {
    elements.body.innerHTML = `<tr><td colspan="5" style="text-align:center;">No students found</td></tr>`;
    return;
  }

  // Group students by classLevel
  const groupedByClass = {};
  students.forEach(student => {
    const classLevel = student.classLevel || 'Unassigned';
    if (!groupedByClass[classLevel]) {
      groupedByClass[classLevel] = [];
    }
    groupedByClass[classLevel].push(student);
  });

  // Sort classes (you can customize this order)
  const classOrder = ['PlayGroup', 'PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 
                      'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Unassigned'];
  const sortedClasses = Object.keys(groupedByClass).sort((a, b) => {
    const indexA = classOrder.indexOf(a);
    const indexB = classOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // Build HTML with grouped sections
  let html = '';
  sortedClasses.forEach(classLevel => {
    const classStudents = groupedByClass[classLevel];
    // Add class header row
    html += `
      <tr style="background-color: #e3f2fd; font-weight: bold;">
        <td colspan="5" style="padding: 12px; font-size: 1.1em;">
          <i class="fa-solid fa-users"></i> ${classLevel} (${classStudents.length} student${classStudents.length !== 1 ? 's' : ''})
        </td>
      </tr>
    `;
    // Add students in this class
    classStudents.forEach(s => {
      html += `
        <tr>
          <td>${s.admissionNumber || 'N/A'}</td>
          <td>${s.name}</td>
          <td>${s.classLevel}</td>
          <td>${s.parent?.name || 'N/A'}</td>
          <td><button class="view-btn" data-id="${s._id}">👁️ View</button></td>
        </tr>
      `;
    });
  });

  elements.body.innerHTML = html;

  // Attach event listeners to view buttons
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