const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/teachers/login.html';
}

// ==================== SUBJECT CONFIG ====================

const EARLY_CHILDHOOD_SUBJECTS = [
  { name: 'Mathematical Activities', label: 'Math Act.', defaultMax: 100 },
  { name: 'English Activities', label: 'English', defaultMax: 100 },
  { name: 'Kiswahili Activities', label: 'Kiswahili', defaultMax: 100 },
  { name: 'Environmental Activities', label: 'Env. Act.', defaultMax: 100 },
  { name: 'Hygiene and Nutrition', label: 'Hygiene', defaultMax: 100 },
  { name: 'Psychomotor Activities', label: 'Psychomotor', defaultMax: 100 },
  { name: 'Creative Activities', label: 'Creative', defaultMax: 100 },
  { name: 'Religious Activities', label: 'Religious', defaultMax: 100 }
];

const PRIMARY_SUBJECTS = [
  { name: 'Mathematics', label: 'Math', defaultMax: 100 },
  { name: 'English', label: 'ENG', defaultMax: 100 },
  { name: 'Kiswahili', label: 'KISW', defaultMax: 100 },
  { name: 'Science and Technology', label: 'SCI', defaultMax: 100 },
  { name: 'Social Studies', label: 'SST', defaultMax: 100 },
  { name: 'Agriculture', label: 'AGRI', defaultMax: 70 },
  { name: 'Home Science', label: 'H/SC', defaultMax: 70 },
  { name: 'Creative Arts', label: 'C/ARTS', defaultMax: 100 },
  { name: 'Physical and Health Education', label: 'PHE', defaultMax: 100 },
  { name: 'Religious Education', label: 'CRE/IRE', defaultMax: 100 }
];

function getSubjectsByClass(classLevel) {
  if (!classLevel) return PRIMARY_SUBJECTS;
  const earlyChildhoodClasses = ['Playgroup', 'PP1', 'PP2', 'PP3'];
  return earlyChildhoodClasses.includes(classLevel) ? EARLY_CHILDHOOD_SUBJECTS : PRIMARY_SUBJECTS;
}

// GLOBAL VARIABLES 

const CURRENT_YEAR = 2026;
let currentStudents = [];
let isPastDueDate = false;
let lockedSubjects = new Set();

let autoSaveEnabled = true;
let autoSaveTimeout = null;
const AUTO_SAVE_DELAY = 1200; // 1.2 seconds

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
  message: document.getElementById('message'),
  notificationsSection: document.getElementById('notificationsSection'),
  notificationsList: document.getElementById('notificationsList')
};

// Load auto-save preference
function loadAutoSavePreference() {
  const saved = localStorage.getItem('autoSaveEnabled');
  if (saved !== null) autoSaveEnabled = saved === 'true';
}

// Auto-save toggle
function toggleAutoSave(enabled) {
  autoSaveEnabled = enabled;
  localStorage.setItem('autoSaveEnabled', enabled);
}

// UI HELPERS 

function showMessage(text, type = 'info') {
  if (!elements.message) return;
  elements.message.textContent = text;
  elements.message.className = `message ${type}`;
  elements.message.style.display = 'block';
  setTimeout(() => elements.message.style.display = 'none', 7000);
}

// Visual Auto-save Indicator
function showSaveStatus(message, type = 'info') {
  let indicator = document.getElementById('autoSaveIndicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'autoSaveIndicator';
    indicator.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 10000;
      background: rgba(0,0,0,0.85); color: white; padding: 10px 16px;
      border-radius: 8px; font-size: 14px; font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: none;
      align-items: center; gap: 8px; transition: all 0.3s ease;
    `;
    document.body.appendChild(indicator);
  }

  let icon = '';
  if (type === 'saving') icon = '⟳';
  else if (type === 'success') icon = '✓';
  else if (type === 'error') icon = '⚠';

  indicator.innerHTML = `${icon} ${message}`;
  indicator.style.display = 'flex';

  if (type === 'success') {
    setTimeout(() => {
      indicator.style.opacity = '0';
      setTimeout(() => { indicator.style.display = 'none'; indicator.style.opacity = '1'; }, 300);
    }, 3000);
  }
}

// SAVE FUNCTION 

async function saveResults(isAuto = false) {
  if (isPastDueDate || (isAuto && !autoSaveEnabled)) return;

  const cls = elements.classSelect.value?.trim();
  const term = elements.termSelect.value?.trim();
  if (!cls || !term) return;

  const maxScores = getMaxScoresFromHeader();
  const scoreInputs = document.querySelectorAll('.score-input:not(:disabled)');

  const byStudent = new Map();

  scoreInputs.forEach(input => {
    const studentId = input.dataset.student;
    const subjectName = input.dataset.subject;
    if (!studentId || !subjectName) return;

    const max = maxScores.get(subjectName) ?? 100;
    const raw = input.value.trim();
    const score = raw === '' ? 0 : Number(raw);

    if (!Number.isFinite(score)) return;

    if (!byStudent.has(studentId)) byStudent.set(studentId, []);
    byStudent.get(studentId).push({ name: subjectName, score, maxScore: max });
  });

  if (byStudent.size === 0) return;

  const payload = {
    classLevel: cls,
    term,
    results: Array.from(byStudent.entries()).map(([studentId, subjects]) => ({
      studentId,
      subjects
    }))
  };

  showSaveStatus(isAuto ? 'Auto-saving...' : 'Saving...', 'saving');

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
      throw new Error(errData.message || `Server error (${res.status})`);
    }

    const data = await res.json();
    showSaveStatus(`✓ Saved ${data.saved || 0} results`, 'success');

  } catch (err) {
    console.error('Save error:', err);
    showSaveStatus(`Save failed: ${err.message}`, 'error');
  }
}

// Debounced Auto-save
function triggerAutoSave() {
  if (!autoSaveEnabled || isPastDueDate) return;
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => saveResults(true), AUTO_SAVE_DELAY);
}

// ==================== VALIDATION & COMPUTE ====================

function validateScoreInput(input, max) {
  const val = input.value.trim();
  if (val === '') {
    input.style.borderColor = '';
    input.setCustomValidity('');
    return;
  }
  const num = Number(val);
  if (isNaN(num) || num < 0 || num > max) {
    input.style.borderColor = 'red';
    input.setCustomValidity(`Score must be 0–${max}`);
  } else {
    input.style.borderColor = '';
    input.setCustomValidity('');
  }
}

function getMaxScoresFromHeader() {
  const map = new Map();
  document.querySelectorAll('.outof-input').forEach(input => {
    const subject = input.dataset.subject;
    let max = Number(input.value);
    map.set(subject, Number.isFinite(max) && max > 0 ? max : 100);
  });
  return map;
}

function computeTotalsAndPositions() {
  const rows = Array.from(elements.studentsBody.querySelectorAll('tr'));
  
  rows.forEach(row => {
    let total = 0;
    row.querySelectorAll('.score-input').forEach(input => {
      const val = input.value.trim();
      total += val === '' ? 0 : (Number(val) || 0);
    });
    const totalCell = row.querySelector('[data-total]');
    if (totalCell) totalCell.textContent = total;
  });

  // Position ranking
  const sortedRows = [...rows].sort((a, b) => {
    const ta = Number(a.querySelector('[data-total]').textContent) || 0;
    const tb = Number(b.querySelector('[data-total]').textContent) || 0;
    return tb - ta;
  });

  sortedRows.forEach((row, idx) => {
    const posCell = row.querySelector('[data-position]');
    if (posCell) posCell.textContent = idx + 1;
  });
}

// LOAD NOTIFICATIONS 

async function loadNotifications() {
  try {
    const res = await fetch('/api/teachers/result-due', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('token');
        window.location.href = '/teachers/login.html';
      }
      return;
    }

    const dueDates = await res.json();
    const now = new Date();
    const upcoming = dueDates.filter(dd => new Date(dd.dueDate) > now);

    if (upcoming.length === 0) {
      elements.notificationsSection.style.display = 'none';
      return;
    }

    upcoming.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const html = upcoming.slice(0, 5).map(dd => {
      const due = new Date(dd.dueDate);
      const days = Math.ceil((due - now) / 86400000);
      const isUrgent = days <= 3;
      const isOverdue = days < 0;

      let cls = 'notification-item';
      if (isOverdue) cls += ' danger';
      else if (isUrgent) cls += ' warning';

      return `
        <div class="${cls}">
          <div class="notification-content">
            <h4>${dd.subject ? `Due: ${dd.subject}` : `Class ${dd.classLevel || 'All'} Results`}</h4>
            <p>Due by ${due.toLocaleDateString()}</p>
          </div>
          <div class="notification-date">
            ${isOverdue ? 'Overdue' : days === 0 ? 'Today' : `${days} day${days !== 1 ? 's' : ''}`}
          </div>
        </div>`;
    }).join('');

    elements.notificationsList.innerHTML = html;
    elements.notificationsSection.style.display = 'block';
  } catch (err) {
    console.error('Notifications error:', err);
    elements.notificationsSection.style.display = 'none';
  }
}

// ==================== RENDER TABLE ====================

function renderTable(className, term) {
  const subjects = getSubjectsByClass(className);
  elements.classTitle.textContent = `${className} — ${term} ${CURRENT_YEAR}`;

  // Header
  elements.headerRow.innerHTML = `
    <th style="min-width:240px; text-align:left;">Learner Name</th>
    ${subjects.map(s => `<th style="min-width:95px; text-align:center;">${s.label}</th>`).join('')}
    <th style="min-width:90px; text-align:center;">TOTAL</th>
    <th style="min-width:100px; text-align:center;">POSITION</th>
  `;

  // Out Of Row
  elements.outOfRow.innerHTML = `
    <th>OUT OF</th>
    ${subjects.map(s => `
      <th style="text-align:center;">
        <input type="number" class="outof-input" data-subject="${s.name}" 
               value="${s.defaultMax}" min="1" style="width:75px; text-align:center;" 
               ${isPastDueDate ? 'disabled' : ''}>
      </th>
    `).join('')}
    <th></th><th></th>
  `;

  // Students
  elements.studentsBody.innerHTML = currentStudents.map(student => {
    const existingMap = new Map(student.existingSubjects.map(sub => [sub.name, sub]));
    return `
      <tr data-student-id="${student._id}">
        <td style="font-weight:600;">${student.name}</td>
        ${subjects.map(s => {
          const ex = existingMap.get(s.name);
          const locked = isPastDueDate || lockedSubjects.has(s.name);
          return `
            <td style="text-align:center;">
              <input type="number" min="0" step="1" class="score-input"
                data-student="${student._id}" data-subject="${s.name}"
                value="${ex?.score ?? ''}" placeholder="—"
                ${locked ? 'disabled style="background:#f1f1f1; cursor:not-allowed;"' : ''}>
              <input type="hidden" class="maxscore-hidden" 
                data-student="${student._id}" data-subject="${s.name}" 
                value="${ex?.maxScore ?? s.defaultMax}">
            </td>`;
        }).join('')}
        <td data-total style="text-align:center; font-weight:700;">0</td>
        <td data-position style="text-align:center; font-weight:700;">-</td>
      </tr>`;
  }).join('');

  // Event Listeners
  document.querySelectorAll('.score-input').forEach(input => {
    input.addEventListener('input', () => {
      const max = getMaxScoresFromHeader().get(input.dataset.subject) ?? 100;
      validateScoreInput(input, max);
      computeTotalsAndPositions();
      triggerAutoSave();
    });
  });

  document.querySelectorAll('.outof-input').forEach(input => {
    input.addEventListener('input', computeTotalsAndPositions);
  });

  computeTotalsAndPositions();

  // Submit Button
  if (elements.submitBtn) {
    elements.submitBtn.disabled = isPastDueDate;
    elements.submitBtn.textContent = isPastDueDate ? 'Submission Closed' : 'Save All Results';
    elements.submitBtn.onclick = () => {
      clearTimeout(autoSaveTimeout);
      saveResults(false);
    };
  }
}

// ==================== LOAD CLASS DATA ====================

elements.loadBtn?.addEventListener('click', async () => {
  const cls = elements.classSelect.value?.trim();
  const term = elements.termSelect.value?.trim();
  if (!cls || !term) {
    showMessage('Please select Class and Term.', 'error');
    return;
  }

  showMessage('Loading learners...', 'loading');

  try {
    renderTable(cls, term);
    elements.studentsSection.style.display = 'block';

  } catch (err) {
    console.error(err);
    showMessage(`Error loading data: ${err.message}`, 'error');
  }
});

// Clear Button
elements.clearBtn?.addEventListener('click', () => {
  if (!confirm('Clear all scores on this page?')) return;
  document.querySelectorAll('.score-input:not(:disabled)').forEach(i => i.value = '');
  computeTotalsAndPositions();
  if (autoSaveEnabled && !isPastDueDate) triggerAutoSave();
});

// Logout
elements.logoutBtn?.addEventListener('click', () => {
  if (confirm('Log out?')) {
    localStorage.removeItem('token');
    window.location.href = '/teachers/login.html';
  }
});

// ==================== INITIALIZE ====================

loadAutoSavePreference();
loadNotifications();

// Add Auto-save Toggle UI (place this where you want the toggle to appear)
const toggleHTML = `
  <div style="margin: 15px 0; display: flex; align-items: center; gap: 8px; font-size: 14px;">
    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; user-select:none;">
      <input type="checkbox" id="autoSaveToggle" ${autoSaveEnabled ? 'checked' : ''}>
      <span>Enable Auto-save</span>
    </label>
  </div>
`;
elements.notificationsSection?.insertAdjacentHTML('afterend', toggleHTML);

document.getElementById('autoSaveToggle')?.addEventListener('change', (e) => {
  toggleAutoSave(e.target.checked);
});