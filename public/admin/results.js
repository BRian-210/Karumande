// /admin/results.js - FINAL WORKING VERSION

const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login.html';
}

// DOM Elements
const elements = {
  classSelect: document.getElementById('class'),
  termSelect: document.getElementById('term'),
  loadBtn: document.getElementById('loadBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  resultsBody: document.getElementById('resultsBody'),
  messageEl: document.getElementById('message')
};

// Warn if critical elements are missing
Object.entries(elements).forEach(([key, el]) => {
  if (!el && !['messageEl'].includes(key)) {
    console.warn(`Missing element: #${key}`);
  }
});

function showMessage(text, type = 'error') {
  if (elements.messageEl) {
    elements.messageEl.textContent = text;
    elements.messageEl.className = `message ${type}`;
    elements.messageEl.style.display = 'block';
    setTimeout(() => { elements.messageEl.style.display = 'none'; }, 5000);
  } else if (elements.resultsBody) {
    const colors = { error: '#d32f2f', success: '#2e7d32', loading: '#f57c00' };
    elements.resultsBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center; padding:2rem; color:${colors[type] || '#d32f2f'}; font-weight:bold;">
          ${text}
        </td>
      </tr>
    `;
  }
}

// Event Listeners
elements.loadBtn?.addEventListener('click', fetchResults);
elements.logoutBtn?.addEventListener('click', () => {
  if (confirm('Log out of Admin Panel?')) {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
  }
});

// MAIN FUNCTION - FETCH RESULTS
async function fetchResults() {
  const cls = elements.classSelect?.value?.trim();
  const term = elements.termSelect?.value?.trim();

  if (!cls || !term) {
    showMessage('Please select both Class and Term.', 'error');
    return;
  }

  showMessage(`Loading results for ${cls} - ${term}...`, 'loading');
  if (elements.resultsBody) elements.resultsBody.innerHTML = '';

  try {
    const url = `/api/results?class=${encodeURIComponent(cls)}&term=${encodeURIComponent(term)}&year=2026`;
    console.log('Fetching:', url);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // Handle unauthorized access
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      showMessage('Session expired. Redirecting to login...', 'error');
      setTimeout(() => window.location.href = '/login.html', 1500);
      return;
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Failed to load results (HTTP ${res.status})`);
    }

    const data = await res.json();
    const students = Array.isArray(data) ? data : ( data.data || []);

    if (!students.length) {
      showMessage(`No results found for ${cls} - ${term} (2026)`, 'error');
      return;
    }

    renderResultsTable(students);
    showMessage(`Loaded ${students.length} student results successfully!`, 'success');

  } catch (err) {
    console.error('Fetch error:', err);
    showMessage(`Error: ${err.message}`, 'error');
  }
}

// DYNAMIC TABLE RENDERER
function renderResultsTable(students) {
  if (!elements.resultsBody || !students.length) return;

  const table = elements.resultsBody.closest('table');
  const thead = table?.querySelector('thead');
  if (!thead) return;

  // Collect subjects from all results
  const subjects = [...new Set(
    students.flatMap(s => (s.subjects || []).map(sub => sub.name))
  )].sort();

  // Header
  thead.innerHTML = `
    <tr style="background:#0d47a1; color:white; text-align:center;">
      <th>Adm No</th>
      <th>Name</th>
      ${subjects.map(s => `<th>${s}</th>`).join('')}
      <th>Total</th>
      <th>Grade</th>
      <th>Action</th>
    </tr>
  `;

  // Rows
  const rows = students.map(student => {
    const subjMap = {};
    (student.subjects || []).forEach(sub => {
      subjMap[sub.name] = sub.score;
    });

    const total = student.total || 0;
    const grade = student.grade || '-';
    const name = student.student?.name || 'Unknown Student';

    let row = `<tr>
      <td>${student.student?.admissionNumber || 'N/A'}</td>
      <td><strong>${name}</strong></td>`;

    subjects.forEach(sub => {
      row += `<td>${subjMap[sub] ?? '-'}</td>`;
    });

    row += `
      <td><strong>${total}</strong></td>
      <td><strong style="color:${grade === 'A' ? 'green' : grade === 'F' ? 'red' : 'inherit'};">${grade}</strong></td>
      <td>
        <button class="edit-btn" data-id="${student._id}">✏️ Edit</button>
      </td>
    </tr>`;

    return row;
  }).join('');

  elements.resultsBody.innerHTML = rows;

  // Edit button handlers
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const name = btn.closest('tr')?.querySelector('td:nth-child(2)')?.textContent?.trim() || 'Student';
      if (confirm(`Edit results for ${name}?`)) {
        window.open(`/admin/edit-result.html?id=${id}`, '_blank');
      }
    });
  });
}