// Teachers Dashboard – Enter Results (updated January 2026)
// Marksheet-style grid:
// - GET  /api/students?classLevel=CLASS
// - GET  /api/results?classLevel=CLASS&term=TERM   (pre-fill all subjects)
// - GET  /api/teachers/result-due?classLevel=CLASS&term=TERM (lock after deadline)
// - POST /api/teachers/results-grid                (save all subjects for all learners)

const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/teachers/login.html';
}

// Subjects shown in the marksheet (labels match your Excel-style view; names saved in DB)
const SUBJECTS = [
  { name: 'Mathematics', label: 'Math', defaultMax: 100 },
  { name: 'English', label: 'ENG', defaultMax: 100 },
  { name: 'Kiswahili', label: 'KISW', defaultMax: 100 },
  { name: 'Science', label: 'SCIENCE', defaultMax: 100 },
  { name: 'Agriculture', label: 'AGRI', defaultMax: 70 },
  { name: 'Pre Tech', label: 'PRE TECH', defaultMax: 100 },
  { name: 'Social Studies', label: 'SST', defaultMax: 100 },
  { name: 'CRE / IRE', label: 'CRE', defaultMax: 100 },
  { name: 'Art & Craft', label: 'CAS', defaultMax: 110 }
];

const elements = {
  classSelect: document.getElementById('classSelect'),
  termSelect: document.getElementById('termSelect'),
  loadBtn: document.getElementById('loadBtn'),
  submitBtn: document.getElementById('submitClassBtn'),
  clearBtn: document.getElementById('clearBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  studentsSection: document.getElementById('studentsSection'),
  classTitle: document.getElementById('classTitle'),
  headerRow: document.getElementById('headerRow'),
  outOfRow: document.getElementById('outOfRow'),
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
let lockedSubjects = new Set(); // subject.name locked for teachers after subject-specific due date
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

function getMaxScoresFromHeader() {
  const outOfInputs = document.querySelectorAll('.outof-input');
  const map = new Map();
  outOfInputs.forEach(input => {
    const subjectName = input.dataset.subject;
    const max = Number(input.value);
    map.set(subjectName, Number.isFinite(max) && max > 0 ? max : 100);
  });
  return map;
}

function computeTotalsAndPositions() {
  const rows = Array.from(elements.studentsBody.querySelectorAll('tr'));
  const totals = rows.map(row => {
    const totalCell = row.querySelector('[data-total]');
    const inputs = row.querySelectorAll('.score-input');
    let sum = 0;
    inputs.forEach(i => {
      const v = i.value.trim();
      const n = v === '' ? 0 : Number(v);
      sum += Number.isFinite(n) ? n : 0;
    });
    if (totalCell) totalCell.textContent = String(sum);
    return { row, sum };
  });

  // Sort by total descending to get positions
  totals.sort((a, b) => b.sum - a.sum);
  totals.forEach((t, idx) => {
    const posCell = t.row.querySelector('[data-position]');
    if (posCell) posCell.textContent = String(idx + 1);
  });
}

elements.loadBtn?.addEventListener('click', async () => {
  const cls = elements.classSelect.value?.trim();
  const term = elements.termSelect.value?.trim();

  if (!cls || !term) {
    showMessage('Please select Class and Term.', 'error');
    return;
  }

  showMessage('Loading learners...', 'loading');

  try {
    // 0) Check due date first (class-level lock + subject locks)
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
      
      // Class-level due date (locks everything for teachers)
      const classDueDate = dueDates.find(dd => !dd.subject);
      if (classDueDate && new Date(classDueDate.dueDate) < now) {
        isPastDueDate = true;
        lockedSubjects = new Set(SUBJECTS.map(s => s.name));
        showMessage(
          `⚠️ Submission deadline has passed (${new Date(classDueDate.dueDate).toLocaleString()}). Only admins can edit results now.`,
          'error'
        );
      } else {
        isPastDueDate = false;
        // Subject-specific locks (optional)
        lockedSubjects = new Set();
        dueDates
          .filter(dd => dd.subject && new Date(dd.dueDate) < now)
          .forEach(dd => lockedSubjects.add(dd.subject));
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

    // 2) Load existing results for this class & term, to pre-fill all subject scores
    const resultsQuery = new URLSearchParams({
      classLevel: cls,
      term: term
    }).toString();

    const resResults = await fetch(`/api/results?${resultsQuery}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const existingByStudent = new Map(); // studentId -> { subjects: [{name,score,maxScore}] }
    if (resResults.ok) {
      const resultsPayload = await resResults.json();
      const results = Array.isArray(resultsPayload.data)
        ? resultsPayload.data
        : (Array.isArray(resultsPayload) ? resultsPayload : []);

      results.forEach(r => {
        if (r.student?._id) {
          existingByStudent.set(String(r.student._id), {
            subjects: Array.isArray(r.subjects) ? r.subjects : []
          });
        }
      });
    }

    // 3) Build currentStudents with existing subject scores
    currentStudents = students.map((s, idx) => ({
      _id: s._id,
      name: s.name || s.fullName || s.studentName || 'Unknown',
      admissionNo: s.admissionNumber || s.admNo || s.regNo || '-',
      index: idx + 1,
      existingSubjects: existingByStudent.get(String(s._id))?.subjects || []
    }));

    renderTable(cls, term);
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

function renderTable(className, term) {
  elements.classTitle.textContent = `${className} — ${term} ${CURRENT_YEAR} Results`;

  // Header row (subjects + total + position)
  elements.headerRow.innerHTML = `
    <th style="min-width:220px;">NAMES</th>
    ${SUBJECTS.map(s => `<th style="min-width:90px;text-align:center;">${s.label}</th>`).join('')}
    <th style="min-width:90px;text-align:center;">TOTAL</th>
    <th style="min-width:110px;text-align:center;">POSITION</th>
  `;

  // Out-of row (max score per subject)
  elements.outOfRow.innerHTML = `
    <th>OUT OF</th>
    ${SUBJECTS.map(s => {
      const disabled = isPastDueDate ? 'disabled' : '';
      return `<th style="text-align:center;">
        <input class="outof-input" data-subject="${s.name}" type="number" min="1" max="1000" value="${s.defaultMax}" style="width:80px;text-align:center;" ${disabled}/>
      </th>`;
    }).join('')}
    <th></th>
    <th></th>
  `;

  // Render body
  elements.studentsBody.innerHTML = currentStudents.map(student => {
    const existingMap = new Map(
      (student.existingSubjects || []).map(sub => [String(sub.name || ''), sub])
    );

    return `
      <tr data-student-row="${student._id}">
        <td style="font-weight:600;">${student.name}</td>
        ${SUBJECTS.map(s => {
          const existing = existingMap.get(s.name);
          const val = existing?.score ?? '';
          const maxVal = existing?.maxScore ?? s.defaultMax;
          const locked = isPastDueDate || lockedSubjects.has(s.name);
          return `
            <td style="text-align:center;">
              <input
                class="score-input"
                data-student="${student._id}"
                data-subject="${s.name}"
                type="number"
                min="0"
                step="1"
                value="${val}"
                placeholder="—"
                ${locked ? 'disabled style="background:#f3f4f6;cursor:not-allowed;"' : ''}
              />
              <input type="hidden" class="maxscore-hidden" data-student="${student._id}" data-subject="${s.name}" value="${maxVal}">
            </td>
          `;
        }).join('')}
        <td data-total style="text-align:center;font-weight:700;">0</td>
        <td data-position style="text-align:center;font-weight:700;">-</td>
      </tr>
    `;
  }).join('');

  // Configure submit button state
  if (elements.submitBtn) {
    if (isPastDueDate) {
      elements.submitBtn.disabled = true;
      elements.submitBtn.style.opacity = '0.6';
      elements.submitBtn.style.cursor = 'not-allowed';
      elements.submitBtn.textContent = 'Submission Closed';
    } else {
      elements.submitBtn.disabled = false;
      elements.submitBtn.style.opacity = '1';
      elements.submitBtn.style.cursor = 'pointer';
      elements.submitBtn.textContent = 'Save All Results';
    }
  }

  // Wire validation + recompute totals
  const maxMap = getMaxScoresFromHeader();
  elements.studentsBody.querySelectorAll('.score-input').forEach(input => {
    input.addEventListener('input', () => {
      const subjectName = input.dataset.subject;
      const max = maxMap.get(subjectName) ?? 100;
      validateScoreInput(input, max);
      computeTotalsAndPositions();
    });
  });
  document.querySelectorAll('.outof-input').forEach(input => {
    input.addEventListener('input', () => {
      computeTotalsAndPositions();
    });
  });

  computeTotalsAndPositions();
}

elements.submitBtn?.addEventListener('click', async () => {
  // Check due date again before submitting
  if (isPastDueDate) {
    showMessage('Submission deadline has passed. Only admins can edit results now.', 'error');
    return;
  }

  const cls = elements.classSelect.value?.trim();
  const term = elements.termSelect.value?.trim();
  if (!cls || !term) {
    showMessage('Please select Class and Term.', 'error');
    return;
  }

  const maxScores = getMaxScoresFromHeader();
  const inputs = document.querySelectorAll('.score-input');

  // Client-side validation (already done earlier, but double-check)
  const invalid = Array.from(inputs).filter(input => {
    if (input.disabled) return false;
    const subjectName = input.dataset.subject;
    const max = maxScores.get(subjectName) ?? 100;
    const valRaw = input.value.trim();
    if (valRaw === '') return false; // allow blank (treated as 0 on save)
    const val = Number(valRaw);
    return isNaN(val) || val < 0 || val > max;
  });

  if (invalid.length > 0) {
    invalid.forEach(i => i.reportValidity());
    showMessage(`Please correct ${invalid.length} invalid score(s).`, 'error');
    return;
  }

  // Build payload: per student, all subjects
  const byStudent = new Map(); // studentId -> subjects[]
  Array.from(inputs).forEach(input => {
    const studentId = input.dataset.student;
    const subjectName = input.dataset.subject;
    if (!studentId || !subjectName) return;
    if (input.disabled) return; // do not submit locked subjects

    const max = maxScores.get(subjectName) ?? 100;
    const raw = input.value.trim();
    const score = raw === '' ? 0 : Number(raw);
    if (!Number.isFinite(score)) return;

    const list = byStudent.get(studentId) || [];
    list.push({ name: subjectName, score, maxScore: max });
    byStudent.set(studentId, list);
  });

  const payload = {
    classLevel: cls,
    term,
    results: Array.from(byStudent.entries()).map(([studentId, subjects]) => ({
      studentId,
      subjects
    }))
  };

  showMessage('Saving results...', 'loading');

  try {
    const res = await fetch('/api/teachers/results-grid', {
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

    // Backend returns { saved: number, failed: array }
    const savedCount = data.saved ?? 0;
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

// Clear scores (UI only)
elements.clearBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  if (!confirm('Clear all scores on this sheet?')) return;
  document.querySelectorAll('.score-input').forEach(i => {
    if (!i.disabled) i.value = '';
  });
  computeTotalsAndPositions();
});