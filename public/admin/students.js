const API_BASE = ''; // e.g., 'https://api.karumande.ac.ke' or leave empty for same origin

// Auth protection (admin login stores `token`)
if (!localStorage.getItem('token')) {
  window.location.href = '/admin/login.html';
}

// Dynamic current date
function updateCurrentDate() {
  const now = new Date();
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('currentDate').textContent = now.toLocaleDateString('en-KE', options);
}

// Unified error display
function showError(message) {
  document.getElementById('gradeLoading').innerHTML = `
    <i class="fa-solid fa-exclamation-triangle" style="color:var(--warning);"></i><br>
    ${message}<br><small>Contact IT if this persists.</small>
  `;
}

// Add row helper (safer DOM updates)
function addRow(tbody, cells, isTotal = false) {
  const row = document.createElement('tr');
  if (isTotal) {
    row.style.fontWeight = '700';
    row.style.background = '#f0f7ff';
  }
  row.innerHTML = cells.map(c => `<td>${c}</td>`).join('');
  tbody.appendChild(row);
}

// Load student stats
async function loadStudentStats() {
  try {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No authentication token found');

    // Fetch summary
    const summaryRes = await fetch(`${API_BASE}/api/students/summary`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!summaryRes.ok) throw new Error(`Failed to load summary: ${summaryRes.status} - ${await summaryRes.text()}`);
    const summary = await summaryRes.json();

    // Update summary stats
    document.getElementById('totalStudents').textContent = summary.total || 0;
    document.getElementById('totalBoys').textContent = summary.boys || 0;
    document.getElementById('totalGirls').textContent = summary.girls || 0;
    document.getElementById('newAdmissions').textContent = summary.new2026 || 0;

    // Fetch grade breakdown
    const gradeRes = await fetch(`${API_BASE}/api/students/by-grade`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!gradeRes.ok) throw new Error(`Failed to load grade data: ${gradeRes.status} - ${await gradeRes.text()}`);
    const grades = await gradeRes.json();

    const tbody = document.getElementById('gradeTableBody');
    tbody.innerHTML = '';
    let grandTotal = 0;

    grades.forEach(g => {
      const boys = g.boys || 0;
      const girls = g.girls || 0;
      const total = boys + girls;
      grandTotal += total;
      const percentage = summary.total ? ((total / summary.total) * 100).toFixed(1) : '0';
      addRow(tbody, [g.grade || 'Unknown', boys, girls, total, `${percentage}%`]);
    });

    // Add total row
    addRow(tbody, [summary.boys || 0, summary.girls || 0, summary.total || grandTotal, '100%'], true);

    document.getElementById('gradeLoading').style.display = 'none';

  } catch (err) {
    console.error('Error loading student data:', err);
    showError(`Failed to load data (${err.message}). Showing demo data.`);
    showDemoData();
  }
}

// Demo data fallback
function showDemoData() {
  document.getElementById('totalStudents').textContent = '245';
  document.getElementById('totalBoys').textContent = '118';
  document.getElementById('totalGirls').textContent = '127';
  document.getElementById('newAdmissions').textContent = '35';

  const tbody = document.getElementById('gradeTableBody');
  tbody.innerHTML = '';
  const demoGrades = [
    { grade: 'PlayGroup', boys: 12, girls: 14 },
    { grade: 'PP1', boys: 15, girls: 16 },
    { grade: 'PP2', boys: 18, girls: 17 },
    { grade: 'Grade 1', boys: 16, girls: 18 },
    { grade: 'Grade 2', boys: 17, girls: 19 },
    { grade: 'Grade 3', boys: 14, girls: 15 },
    { grade: 'Grade 4', boys: 16, girls: 14 },
    { grade: 'Grade 5', boys: 13, girls: 12 },
    { grade: 'Grade 6', boys: 15, girls: 16 },
    { grade: 'Grade 7', boys: 12, girls: 14 },
    { grade: 'Grade 8', boys: 14, girls: 13 },
    { grade: 'Grade 9', boys: 11, girls: 13 }
  ];
  const total = 245;

  demoGrades.forEach(g => {
    const subtotal = g.boys + g.girls;
    const percentage = ((subtotal / total) * 100).toFixed(1);
    addRow(tbody, [g.grade, g.boys, g.girls, subtotal, `${percentage}%`]);
  });

  addRow(tbody, [118, 127, 245, '100%'], true);
}

// Logout
function logout() {
  if (confirm('Log out of admin panel?')) {
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken'); // backwards-compat
    localStorage.removeItem('adminName');
    sessionStorage.clear();
    window.location.href = '/admin/login.html';
  }
}

// Mobile menu toggle
document.getElementById('mobileToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// Init
window.addEventListener('load', () => {
  updateCurrentDate();
  loadStudentStats();

  // Timeout fallback
  setTimeout(() => {
    const gradeLoading = document.getElementById('gradeLoading');
    if (gradeLoading && gradeLoading.style.display !== 'none') {
      showDemoData();
      gradeLoading.style.display = 'none';
    }
  }, 5000);

  // Optional auto-refresh
  // setInterval(loadStudentStats, 300000);
});