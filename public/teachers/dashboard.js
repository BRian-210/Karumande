// Teachers Dashboard – Enter Results (updated January 2026)
// Uses:
// - GET  /api/students?classLevel=CLASS
// - GET  /api/results?classLevel=CLASS&term=TERM  (to pre-fill existing scores)
// - POST /api/teachers/results-batch                (to save scores in bulk)

const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/teachers/login.html';
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
    window.location.href = '/teachers/login.html';
  }
});

let currentStudents = [];
let isPastDueDate = false;
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
    // 0) Check due date first
    const dueDateQuery = new URLSearchParams({
      classLevel: cls,
      term: term
    }).toString();
    
    const dueDateRes = await fetch(`/api/teachers/result-due?${dueDateQuery}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (dueDateRes.ok) {
      const dueDates = await dueDateRes.json();
      const now = new Date();
      
      // Check for class-level due date
      const classDueDate = dueDates.find(dd => !dd.subject);
      // Check for subject-specific due date
      const subjectDueDate = dueDates.find(dd => dd.subject && dd.subject.toLowerCase() === subject.toLowerCase());
      
      const relevantDueDate = subjectDueDate || classDueDate;
      
      if (relevantDueDate && new Date(relevantDueDate.dueDate) < now) {
        isPastDueDate = true;
        showMessage(
          `⚠️ Submission deadline has passed (${new Date(relevantDueDate.dueDate).toLocaleString()}). Only admins can edit results now.`,
          'error'
        );
      } else {
        isPastDueDate = false;
      }
    }

    // 1) Load students in selected class
    const studentsQuery = new URLSearchParams({
      classLevel: cls
    }).toString();

    const res = await fetch(`/api/students?${studentsQuery}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      window.location.href = '/teachers/login.html';
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

    // 2) Load existing results for this class & term, to pre-fill scores for the chosen subject
    const resultsQuery = new URLSearchParams({
      classLevel: cls,
      term: term
    }).toString();

    const resResults = await fetch(`/api/results?${resultsQuery}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    let existingScores = new Map(); // studentId -> score for selected subject
    if (resResults.ok) {
      const resultsPayload = await resResults.json();
      const results = Array.isArray(resultsPayload.data)
        ? resultsPayload.data
        : (Array.isArray(resultsPayload) ? resultsPayload : []);

      results.forEach(r => {
        const subj = Array.isArray(r.subjects)
          ? r.subjects.find(s => s.name?.toLowerCase() === subject.toLowerCase())
          : null;
        if (subj && r.student?._id) {
          existingScores.set(String(r.student._id), subj.score ?? '');
        }
      });
    }

    // 3) Build currentStudents with any existing score for this subject
    currentStudents = students.map((s, idx) => ({
      _id: s._id,
      name: s.name || s.fullName || s.studentName || 'Unknown',
      admissionNo: s.admissionNumber || s.admNo || s.regNo || '-',
      index: idx + 1,
      score: existingScores.get(String(s._id)) ?? ''  // pre-fill if we have previous score
    }));

    renderTable(cls, subject, term, maxScore);
    elements.studentsSection.style.display = 'block';
    
    if (isPastDueDate) {
      showMessage(
        `⚠️ Submission deadline has passed. You can view results but cannot edit them. Only admins can make changes.`,
        'error'
      );
    } else {
      showMessage(`Loaded ${students.length} students.`, 'success');
    }

  } catch (err) {
    console.error('Load students error:', err);
    showMessage(`Error loading students: ${err.message}`, 'error');
  }
});

function renderTable(className, subject, term, maxScore) {
  elements.classTitle.textContent = `${className} – ${subject} (${term} 2026)`;
  elements.maxScoreDisplay.textContent = maxScore;

  // Disable inputs if past due date
  const inputDisabled = isPastDueDate ? 'disabled style="background:#f3f4f6;cursor:not-allowed;"' : '';

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
               ${inputDisabled}
               required />
      </td>
    </tr>
  `).join('');
  
  // Disable submit button if past due date
  if (elements.submitBtn) {
    if (isPastDueDate) {
      elements.submitBtn.disabled = true;
      elements.submitBtn.style.opacity = '0.6';
      elements.submitBtn.style.cursor = 'not-allowed';
      elements.submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Submission Closed';
    } else {
      elements.submitBtn.disabled = false;
      elements.submitBtn.style.opacity = '1';
      elements.submitBtn.style.cursor = 'pointer';
      elements.submitBtn.innerHTML = '<i class="fa-solid fa-save"></i> Save All Results';
    }
  }

  // Attach real-time validation (CSP-safe, no inline handlers)
  elements.studentsBody.querySelectorAll('.score-input').forEach(input => {
    input.addEventListener('input', () => validateScoreInput(input, maxScore));
  });
}

elements.submitBtn?.addEventListener('click', async () => {
  // Check due date again before submitting
  if (isPastDueDate) {
    showMessage('Submission deadline has passed. Only admins can edit results now.', 'error');
    return;
  }

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