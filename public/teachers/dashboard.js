// Teachers Dashboard – Enter Results (updated January 2026)
// Compatible with backend route: POST /api/results-batch

const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login.html'; // adjust if teachers have separate login
}

const elements = {
  classSelect: document.getElementById('classSelect'),
  termSelect: document.getElementById('termSelect'),
  subjectSelect: document.getElementById('subjectSelect'),
  maxScoreInput: document.getElementById('maxScore'),
  loadBtn: document.getElementById('loadBtn'),
  submitBtn: document.getElementById('submitClassBtn'),
  clearBtn: document.getElementById('clearBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  studentsSection: document.getElementById('studentsSection'),
  classTitle: document.getElementById('classTitle'),
  maxScoreDisplay: document.getElementById('maxScoreDisplay'),
  studentsBody: document.getElementById('studentsBody'),
  message: document.getElementById('message')
};

// Logout
elements.logoutBtn?.addEventListener('click', () => {
  if (confirm('Log out of Teachers Dashboard?')) {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
  }
});

let currentStudents = [];
const CURRENT_YEAR = 2026;

function showMessage(text, type = 'info') {
  if (!elements.message) return;
  elements.message.textContent = text;
  elements.message.className = `message ${type}`;
  elements.message.style.display = 'block';
  setTimeout(() => elements.message.style.display = 'none', 7000);
}

function validateScoreInput(input, max) {
  const val = input.value.trim();
  if (val === '') {
    input.style.borderColor = '';
    input.setCustomValidity('');
    return;
  }
  const num = Number(val);
  if (isNaN(num) || num < 0 || num > max) {
    input.style.borderColor = 'var(--error, red)';
    input.setCustomValidity(`Score must be 0–${max}`);
  } else {
    input.style.borderColor = '';
    input.setCustomValidity('');
  }
}

elements.loadBtn?.addEventListener('click', async () => {
  const cls = elements.classSelect.value?.trim();
  const term = elements.termSelect.value?.trim();
  const subject = elements.subjectSelect.value?.trim();
  const maxScore = Number(elements.maxScoreInput.value);

  if (!cls || !term || !subject || isNaN(maxScore) || maxScore < 1) {
    showMessage('Please complete all fields.', 'error');
    return;
  }

  showMessage('Loading students...', 'loading');

  try {
    const query = new URLSearchParams({
      classLevel: cls,
      year: CURRENT_YEAR
    }).toString();

    const res = await fetch(`/api/students?${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      window.location.href = '/login.html';
      return;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `HTTP ${res.status}`);
    }

    const payload = await res.json();
    const students = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : []);

    if (students.length === 0) {
      showMessage('No students found for this class.', 'error');
      elements.studentsSection.style.display = 'none';
      return;
    }

    currentStudents = students.map((s, idx) => ({
      _id: s._id,
      name: s.name || s.fullName || s.studentName || 'Unknown',
      admissionNo: s.admissionNumber || s.admNo || s.regNo || '-',
      index: idx + 1,
      score: s.score ?? s.currentScore ?? ''  // pre-fill if backend sends existing score
    }));

    renderTable(cls, subject, term, maxScore);
    elements.studentsSection.style.display = 'block';
    showMessage(`Loaded ${students.length} students.`, 'success');

  } catch (err) {
    console.error('Load students error:', err);
    showMessage(`Error loading students: ${err.message}`, 'error');
  }
});

function renderTable(className, subject, term, maxScore) {
  elements.classTitle.textContent = `${className} – ${subject} (${term} 2026)`;
  elements.maxScoreDisplay.textContent = maxScore;

  elements.studentsBody.innerHTML = currentStudents.map(student => `
    <tr>
      <td>${student.index}</td>
      <td>${student.name}</td>
      <td>${student.admissionNo}</td>
      <td>
        <input type="number"
               class="score-input"
               min="0"
               max="${maxScore}"
               step="1"
               value="${student.score}"
               data-id="${student._id}"
               placeholder="—"
               required />
      </td>
    </tr>
  `).join('');

  // Attach real-time validation (CSP-safe, no inline handlers)
  elements.studentsBody.querySelectorAll('.score-input').forEach(input => {
    input.addEventListener('input', () => validateScoreInput(input, maxScore));
  });
}

elements.submitBtn?.addEventListener('click', async () => {
  const maxScore = Number(elements.maxScoreInput.value);
  const inputs = document.querySelectorAll('.score-input');

  // Client-side validation (already done earlier, but double-check)
  const invalid = Array.from(inputs).filter(input => {
    const val = Number(input.value);
    return isNaN(val) || val < 0 || val > maxScore;
  });

  if (invalid.length > 0) {
    invalid.forEach(i => i.reportValidity());
    showMessage(`Please correct ${invalid.length} invalid score(s).`, 'error');
    return;
  }

  // Prepare payload – only send what the backend actually uses
  const payload = {
    term: elements.termSelect.value,
    subject: elements.subjectSelect.value,
    maxScore,
    results: Array.from(inputs).map(input => ({
      studentId: input.dataset.id,
      score: Number(input.value) || 0
    }))
  };

  showMessage('Saving results...', 'loading');

  try {
    const res = await fetch('/api/teachers/results-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errorMsg = errData.message 
        || (errData.errors?.[0]?.msg) 
        || `Server error (${res.status})`;
      throw new Error(errorMsg);
    }

    const data = await res.json();

    // Your backend returns { saved: number, failed: array }
    const savedCount = data.saved ?? data.modified ?? results.length;
    const failedCount = data.failed?.length ?? 0;

    if (failedCount > 0) {
      showMessage(
        `Saved ${savedCount} results. ${failedCount} failed. Check console.`,
        'warning'
      );
      console.warn('Failed saves:', data.failed);
    } else {
      showMessage(`Success! ${savedCount} results saved.`, 'success');
    }

    // Optional: prevent double-submit until page reload
    // elements.submitBtn.disabled = true;
    // elements.submitBtn.textContent = 'Saved ✓';

  } catch (err) {
    console.error('Submit error:', err);
    showMessage(`Could not save results: ${err.message}`, 'error');
  }
});