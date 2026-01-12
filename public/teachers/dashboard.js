// public/teachers/dashboard.js
// Single, clean version – Teacher Dashboard for loading students and submitting results

const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/admin/login.html';
}

// DOM Elements – with fallback safety
const elements = {
  classSelect: document.getElementById('classSelect'),
  termSelect: document.getElementById('termSelect'),
  subjectInput: document.getElementById('subjectInput'),
  maxScoreInput: document.getElementById('maxScore'),
  loadBtn: document.getElementById('loadBtn'),
  submitClassBtn: document.getElementById('submitClassBtn'),
  studentsSection: document.getElementById('studentsSection'),
  classTitle: document.getElementById('classTitle'),
  maxScoreDisplay: document.getElementById('maxScoreDisplay'),
  studentsBody: document.getElementById('studentsBody'),
  message: document.getElementById('message')
};

// Quick guard: if critical elements are missing, log error (helps debugging)
Object.entries(elements).forEach(([key, el]) => {
  if (!el) console.error(`Element not found: #${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
});

let currentStudents = [];

// Utility: show feedback message
function showMessage(text, type = 'info') {
  const msg = elements.message;
  if (!msg) return;
  msg.textContent = text;
  msg.className = `message ${type}`; // e.g., class="message error" or "message success"
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 5000); // auto-hide after 5s
}

// Load students by class
elements.loadBtn?.addEventListener('click', async () => {
  const selectedClass = elements.classSelect?.value?.trim();
  const subject = elements.subjectInput?.value?.trim();
  const term = elements.termSelect?.value;
  const maxScore = parseInt(elements.maxScoreInput?.value);

  if (!selectedClass || !subject || !term || isNaN(maxScore) || maxScore < 1) {
    showMessage('Please fill all fields correctly (class, subject, term, max score).', 'error');
    return;
  }

  showMessage('Loading students...', 'info');

  try {
    const res = await fetch(`/api/students?classLevel=${encodeURIComponent(selectedClass)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      window.location.href = '/admin/login.html';
      return;
    }

    if (!res.ok) throw new Error('Failed to load students');

    const payload = await res.json();
    const students = Array.isArray(payload.data) ? payload.data : payload || [];

    if (students.length === 0) {
      showMessage('No students found in this class.', 'error');
      elements.studentsSection ? (elements.studentsSection.style.display = 'none') : null;
      return;
    }

    // Pre-fill existing scores if any (adjust this logic based on your actual result schema)
    currentStudents = students.map((s, i) => ({
      id: s._id,
      name: s.name || 'Unknown',
      admissionNo: s.admissionNumber || s.admissionNo || '-',
      index: i + 1,
      score: '' // You can enhance this to pull previous scores if API supports it
    }));

    renderStudentsTable(selectedClass, subject, term, maxScore);
    elements.studentsSection ? (elements.studentsSection.style.display = 'block') : null;
    showMessage(`${students.length} students loaded.`, 'success');

  } catch (err) {
    console.error(err);
    showMessage(err.message || 'Error loading students', 'error');
  }
});

function renderStudentsTable(className, subject, term, maxScore) {
  if (!elements.classTitle || !elements.maxScoreDisplay || !elements.studentsBody) return;

  elements.classTitle.textContent = `${className} — ${subject} (${term}, 2026)`;
  elements.maxScoreDisplay.textContent = maxScore;

  elements.studentsBody.innerHTML = currentStudents.map(student => `
    <tr>
      <td>${student.index}</td>
      <td>${student.name}</td>
      <td>${student.admissionNo}</td>
      <td>
        <input
          type="number"
          class="score-input"
          min="0"
          max="${maxScore}"
          value="${student.score}"
          data-id="${student.id}"
          placeholder="0"
          required
        />
      </td>
    </tr>
  `).join('');
}

// Submit results
elements.submitClassBtn?.addEventListener('click', async () => {
  const maxScore = parseInt(elements.maxScoreInput?.value);
  const scoreInputs = document.querySelectorAll('.score-input');

  const results = [];
  let hasError = false;

  scoreInputs.forEach(input => {
    const score = parseInt(input.value);
    if (isNaN(score) || score < 0 || score > maxScore) {
      input.style.borderColor = 'red';
      hasError = true;
    } else {
      input.style.borderColor = '';
      results.push({
        studentId: input.dataset.id,
        score
      });
    }
  });

  if (hasError || results.length === 0) {
    showMessage('Please enter valid scores (0–' + maxScore + ') for all students.', 'error');
    return;
  }

  const body = {
    class: elements.classSelect.value,
    term: elements.termSelect.value,
    subject: elements.subjectInput.value.trim(),
    year: 2026,
    maxScore,
    results
  };

  try {
    const res = await fetch('/api/teachers/results-batch', {  // or '/api/results/bulk' – use consistent endpoint
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to save results');
    }

    const data = await res.json();
    showMessage(`Success! ${data.saved || results.length} results saved.`, 'success');

    // Optional: clear inputs or disable button
  } catch (err) {
    console.error(err);
    showMessage(err.message || 'Error submitting results', 'error');
  }
});