// =============================================
// admin/add-student.js
// =============================================

const elements = {
  mobileToggle: document.getElementById('mobileToggle'),
  sidebar: document.getElementById('sidebar'),
  sidebarLogout: document.getElementById('sidebarLogout'),
  logoutBtn: document.getElementById('logoutBtn'),
  saveBtn: document.getElementById('saveBtn'),
  msg: document.getElementById('msg'),
  name: document.getElementById('name'),
  classLevel: document.getElementById('classLevel'),
  admissionNumber: document.getElementById('admissionNumber'),
  dob: document.getElementById('dob'),
  gender: document.getElementById('gender'),
  parentId: document.getElementById('parentId'),
};

// ── Auth check & redirect ────────────────────────────────────────
const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
if (!token) {
  window.location.href = '/admin/login.html';
}

// ── Get current user info ─────────────────────────────────────────
let currentUser = null;
async function loadCurrentUser() {
  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      adjustUIForRole();
    }
  } catch (err) {
    console.error('Failed to load user info:', err);
  }
}

// ── Adjust UI based on user role ──────────────────────────────────
function adjustUIForRole() {
  if (!currentUser) return;

  const parentIdField = document.getElementById('parentId');
  const parentIdLabel = parentIdField?.previousElementSibling;

  if (currentUser.role === 'parent') {
    // Hide parent selection for parents - they can only add their own children
    if (parentIdField) parentIdField.style.display = 'none';
    if (parentIdLabel) parentIdLabel.style.display = 'none';
  }
}

// ── Mobile sidebar toggle ─────────────────────────────────────────
elements.mobileToggle?.addEventListener('click', () => {
  elements.sidebar?.classList.toggle('open');
});

// ── Sidebar logout proxy ──────────────────────────────────────────
elements.sidebarLogout?.addEventListener('click', () => {
  elements.logoutBtn?.click();
});

// ── Main logout handler ───────────────────────────────────────────
elements.logoutBtn?.addEventListener('click', () => {
  if (!confirm('Log out of admin panel?')) return;

  localStorage.removeItem('token');
  localStorage.removeItem('adminToken'); // legacy support
  window.location.href = '/admin/login.html';
});

// ── Form submission ───────────────────────────────────────────────
elements.saveBtn?.addEventListener('click', async (e) => {
  e.preventDefault();

  // Reset message
  elements.msg.className = 'message'; // assuming you have .message base class
  elements.msg.textContent = '';

  // Gather & trim values
  const values = {
    name: elements.name.value.trim(),
    classLevel: elements.classLevel.value,
    admissionNumber: elements.admissionNumber.value.trim() || undefined,
    dob: elements.dob.value,
    gender: elements.gender.value,
    parentId: elements.parentId.value.trim() || undefined,
  };

  // For parents, automatically set parentId to their own ID
  if (currentUser && currentUser.role === 'parent') {
    values.parentId = currentUser.id;
  }

  // ── Client-side validation ──────────────────────────────────────
  if (!values.name) {
    showError('Student name is required.');
    return;
  }
  if (!values.classLevel) {
    showError('Please select a class/level.');
    return;
  }
  if (!values.gender) {
    showError('Please select a gender.');
    return;
  }
  if (!values.dob) {
    showError('Date of birth is required.');
    return;
  }

  // Optional: basic DOB sanity check (not before 2000 or future)
  if (values.dob) {
    const birthDate = new Date(values.dob);
    const now = new Date();
    if (birthDate > now || birthDate.getFullYear() < 2000) {
      showError('Please enter a valid date of birth.');
      return;
    }
  }

  // ── Prepare payload ──────────────────────────────────────────────
  const payload = {
    name: values.name,
    classLevel: values.classLevel,
    gender: values.gender,
    dob: values.dob,
    ...(values.admissionNumber && { admissionNumber: values.admissionNumber }),
    ...(values.parentId && { parentId: values.parentId }),
  };

  // ── UI loading state ─────────────────────────────────────────────
  elements.saveBtn.disabled = true;
  showMessage('Saving student...', 'loading');

  try {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      let errorMsg = 'Failed to create student';

      if (data.errors?.length) {
        // Joi / express-validator style errors
        errorMsg = data.errors.map(e => e.msg || e.message).join(' • ');
      } else if (data.message || data.error) {
        errorMsg = data.message || data.error;
      }

      throw new Error(errorMsg);
    }

    showMessage('✓ Student created successfully! Redirecting...', 'success');

    setTimeout(() => {
      // Redirect based on user role
      if (currentUser && currentUser.role === 'parent') {
        window.location.href = '/student-dashboard.html';
      } else {
        window.location.href = '/admin/students-list.html';
      }
    }, 1400);

  } catch (err) {
    console.error('Add student failed:', err);
    showError(err.message || 'Something went wrong. Please try again.');
    elements.saveBtn.disabled = false;
  }
});

// ── Initialize ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadCurrentUser();
});