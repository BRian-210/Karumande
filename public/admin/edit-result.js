// /admin/edit-result.js - Edit Student Results

const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
if (!token) {
  window.location.href = '/admin/login.html';
}

// Get result ID from URL
const urlParams = new URLSearchParams(window.location.search);
const resultId = urlParams.get('id');

if (!resultId) {
  alert('No result ID provided. Redirecting...');
  window.location.href = '/admin/results.html';
}

const elements = {
  loading: document.getElementById('loading'),
  resultForm: document.getElementById('resultForm'),
  studentName: document.getElementById('studentName'),
  studentInfo: document.getElementById('studentInfo'),
  term: document.getElementById('term'),
  grade: document.getElementById('grade'),
  comments: document.getElementById('comments'),
  subjectsContainer: document.getElementById('subjectsContainer'),
  addSubjectBtn: document.getElementById('addSubjectBtn'),
  editResultForm: document.getElementById('editResultForm'),
  message: document.getElementById('message')
};

let resultData = null;

// Load result data
async function loadResult() {
  try {
    const res = await fetch(`/api/results/${resultId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('adminToken');
      alert('Session expired. Redirecting to login...');
      window.location.href = '/admin/login.html';
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to load result');
    }

    resultData = await res.json();
    renderForm(resultData);
  } catch (err) {
    showMessage(`Error: ${err.message}`, 'error');
    elements.loading.innerHTML = `<div style="color:var(--danger);text-align:center;"><i class="fa-solid fa-exclamation-triangle"></i><br>${err.message}</div>`;
  }
}

// Render form with result data
function renderForm(result) {
  const student = result.student || {};
  
  elements.studentName.textContent = student.name || 'Unknown Student';
  elements.studentInfo.textContent = `${student.classLevel || 'N/A'} | Admission: ${student.admissionNumber || 'N/A'}`;
  elements.term.value = result.term || '';
  elements.grade.value = result.grade || '';
  elements.comments.value = result.comments || '';

  // Render subjects
  elements.subjectsContainer.innerHTML = '';
  const subjects = Array.isArray(result.subjects) ? result.subjects : [];
  
  if (subjects.length === 0) {
    addSubjectRow();
  } else {
    subjects.forEach((subject, index) => {
      addSubjectRow(subject.name, subject.score, subject.maxScore || 100, index);
    });
  }

  elements.loading.style.display = 'none';
  elements.resultForm.style.display = 'block';
}

// Add subject row
function addSubjectRow(name = '', score = '', maxScore = 100, index = null) {
  const row = document.createElement('div');
  row.className = 'subject-row';
  row.style.cssText = 'display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:12px;align-items:end;margin-bottom:16px;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid var(--border);';
  
  const realIndex = index !== null ? index : elements.subjectsContainer.children.length;
  
  row.innerHTML = `
    <div class="form-group" style="margin:0;">
      <label style="font-size:0.9rem;margin-bottom:6px;">Subject Name</label>
      <input type="text" class="subject-name" value="${name}" placeholder="e.g., Mathematics" required style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;" />
    </div>
    <div class="form-group" style="margin:0;">
      <label style="font-size:0.9rem;margin-bottom:6px;">Max Score</label>
      <input type="number" class="subject-max" value="${maxScore}" min="1" placeholder="100" required style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;" />
    </div>
    <div class="form-group" style="margin:0;">
      <label style="font-size:0.9rem;margin-bottom:6px;">Score</label>
      <input type="number" class="subject-score" value="${score}" min="0" step="0.5" placeholder="0" required style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;" />
    </div>
    <button type="button" class="remove-subject-btn" style="background:var(--danger);color:white;border:none;padding:10px 14px;border-radius:8px;cursor:pointer;height:fit-content;">
      <i class="fa-solid fa-trash"></i>
    </button>
  `;

  // Remove button handler
  row.querySelector('.remove-subject-btn').addEventListener('click', () => {
    if (elements.subjectsContainer.children.length > 1) {
      row.remove();
    } else {
      alert('At least one subject is required');
    }
  });

  elements.subjectsContainer.appendChild(row);
}

// Add subject button handler
elements.addSubjectBtn.addEventListener('click', () => {
  addSubjectRow();
});

// Form submit handler
elements.editResultForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const subjectRows = elements.subjectsContainer.querySelectorAll('.subject-row');
  const subjects = [];
  
  for (const row of subjectRows) {
    const name = row.querySelector('.subject-name').value.trim();
    const score = parseFloat(row.querySelector('.subject-score').value);
    const maxScore = parseFloat(row.querySelector('.subject-max').value) || 100;
    
    if (!name || isNaN(score)) {
      showMessage('Please fill in all subject fields correctly', 'error');
      return;
    }
    
    subjects.push({ name, score, maxScore });
  }

  if (subjects.length === 0) {
    showMessage('At least one subject is required', 'error');
    return;
  }

  const payload = {
    subjects,
    grade: elements.grade.value.trim() || undefined,
    comments: elements.comments.value.trim() || undefined
  };

  try {
    showMessage('Saving changes...', 'loading');
    
    const res = await fetch(`/api/results/${resultId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to save changes');
    }

    showMessage('Result updated successfully!', 'success');
    
    // Optionally reload the page after 1.5 seconds
    setTimeout(() => {
      if (window.opener) {
        window.opener.location.reload();
        window.close();
      } else {
        window.location.href = '/admin/results.html';
      }
    }, 1500);
    
  } catch (err) {
    showMessage(`Error: ${err.message}`, 'error');
  }
});

// Show message helper
function showMessage(text, type = 'error') {
  const colors = {
    error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
    success: { bg: '#d1fae5', border: '#10b981', text: '#065f46' },
    loading: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' }
  };
  
  const style = colors[type] || colors.error;
  elements.message.style.display = 'block';
  elements.message.style.cssText += `background:${style.bg};border:2px solid ${style.border};color:${style.text};padding:16px;border-radius:12px;font-weight:600;`;
  elements.message.textContent = text;
  
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      elements.message.style.display = 'none';
    }, 5000);
  }
}

// Logout function
function logout() {
  if (confirm('Log out of Admin Panel?')) {
    localStorage.removeItem('token');
    localStorage.removeItem('adminToken');
    window.location.href = '/admin/login.html';
  }
}

// Mobile menu toggle
document.getElementById('mobileToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// Load result on page load
loadResult();

