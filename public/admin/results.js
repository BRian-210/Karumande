// /admin/results.js - Updated & Working Version (January 2026)

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
  studentsSection: document.getElementById('studentsSection'),
  classTitle: document.getElementById('classTitle'),
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
        <td colspan="6" style="text-align:center; padding:2rem; color:${colors[type] || '#d32f2f'}; font-weight:bold;">
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
    console.log("Full API response:", data);

    const students = Array.isArray(data) ? data : (data.data || []);

    console.log("Extracted students array length:", students.length);
    console.log("Is students array?", Array.isArray(students));

    if (students.length > 0) {
      const first = students[0];
      console.log("FIRST STUDENT FULL:", JSON.stringify(first, null, 2));
      console.log("FIRST STUDENT KEYS:", Object.keys(first));
    } else {
      console.log("No students after extraction");
    }

    if (!students.length) {
      showMessage(`No results found for ${cls} - ${term} (2026)`, 'error');
      return;
    }

    // Show the table section
    if (elements.studentsSection) {
      elements.studentsSection.style.display = 'block';
    }

    if (elements.classTitle) {
      elements.classTitle.textContent = `${cls} — ${term} 2026  (${students.length} student${students.length !== 1 ? 's' : ''})`;
    }

    renderResultsTable(students);
    showMessage(`Loaded ${students.length} student results successfully!`, 'success');

  } catch (err) {
    console.error('Fetch error:', err);
    showMessage(`Error: ${err.message}`, 'error');
  }
}

// DYNAMIC TABLE RENDERER
function renderResultsTable(results) {
  const tbody = document.getElementById('resultsBody');
  if (!tbody) {
    console.error('Cannot find #resultsBody');
    return;
  }

  if (!results?.length) {
    tbody.innerHTML = '<tr><td colspan="6">No results to display</td></tr>';
    return;
  }

  let html = '';

  html += `
  <tr style="background:#e8f5e9; font-weight:bold;">
    <td colspan="6">: ${results.length} students loaded - table should show below</td>
  </tr>
`;

  results.forEach(result => {
    const studentInfo = result.student || {};
    const name = studentInfo.name || 'Unknown Student';
    const admNo = studentInfo.admissionNumber || studentInfo._id || '—';

    const subjects = Array.isArray(result.subjects) ? result.subjects : [];

    if (subjects.length === 0) {
      html += `
        <tr>
          <td>${name}</td>
          <td>${admNo}</td>
          <td colspan="4" style="text-align:center; color:#d32f2f; font-style:italic;">
            No subjects recorded
          </td>
        </tr>
      `;
      return;
    }

    const rowspan = Math.max(1, subjects.length);

    html += `
      <tr>
        <td rowspan="${rowspan}"><strong>${name}</strong></td>
        <td rowspan="${rowspan}">${admNo}</td>
        <td>${subjects[0]?.name || '—'}</td>
        <td>${subjects[0]?.maxScore ?? 100}</td>
        <td>${subjects[0]?.score ?? '—'}</td>
        <td rowspan="${rowspan}">
          <button class="edit-btn" data-id="${result._id}">Edit</button>
        </td>
      </tr>
    `;

    for (let i = 1; i < subjects.length; i++) {
      const sub = subjects[i];
      html += `
        <tr>
          <td>${sub.name || '—'}</td>
          <td>${sub.maxScore ?? 100}</td>
          <td>${sub.score ?? '—'}</td>
        </tr>
      `;
    }
  });

  tbody.innerHTML = html;
  // Attach edit button handlers
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const resultId = this.dataset.id;
      const studentName = this.closest('tr')?.querySelector('td strong')?.textContent?.trim() || 'this student';
      if (confirm(`Open edit page for ${studentName}?`)) {
        window.open(`/admin/edit-result.html?id=${resultId}`, '_blank');
      }
    });
  });
}