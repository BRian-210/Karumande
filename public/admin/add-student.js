const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
if (!token) {
  window.location.href = '/admin/login.html';
}

const msgEl = document.getElementById('msg');

document.getElementById('saveBtn').addEventListener('click', async (e) => {
  e.preventDefault();

  msgEl.textContent = '';
  msgEl.style.color = '';
  msgEl.style.display = 'block';

  const name = document.getElementById('name').value.trim();
  const classLevel = document.getElementById('classLevel').value;
  const admissionNumber = document.getElementById('admissionNumber').value.trim();
  const dob = document.getElementById('dob').value;
  const gender = document.getElementById('gender').value;
  const parentId = document.getElementById('parentId').value.trim();

  // Validation
  if (!name || !classLevel) {
    msgEl.textContent = 'Please fill in the student name and class.';
    msgEl.style.cssText += 'color:var(--danger);padding:12px;background:#fee2e2;border-radius:8px;';
    return;
  }

  if (!gender) {
    msgEl.textContent = 'Please select a gender.';
    msgEl.style.cssText += 'color:var(--danger);padding:12px;background:#fee2e2;border-radius:8px;';
    return;
  }

  if (!dob) {
    msgEl.textContent = 'Please select a date of birth.';
    msgEl.style.cssText += 'color:var(--danger);padding:12px;background:#fee2e2;border-radius:8px;';
    return;
  }

  const payload = {
    name,
    classLevel,
    gender,
    dob,
    admissionNumber: admissionNumber || undefined,
    parentId: parentId || undefined
  };

  // Show loading state
  msgEl.textContent = 'Saving student...';
  msgEl.style.cssText += 'color:var(--warning);padding:12px;background:#fef3c7;border-radius:8px;';
  document.getElementById('saveBtn').disabled = true;

  try {
    const res = await fetch('/api/students', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      let errMsg = 'Failed to create student';
      
      if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        errMsg = data.errors.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
      } else if (data.message) {
        errMsg = data.message;
      }
      
      throw new Error(errMsg);
    }

    msgEl.textContent = '✓ Student created successfully! Redirecting...';
    msgEl.style.cssText += 'color:var(--success);padding:12px;background:#d1fae5;border-radius:8px;';

    // Redirect to list so the new student is visible under their class
    setTimeout(() => {
      window.location.href = '/admin/students-list.html';
    }, 1500);
  } catch (err) {
    console.error('Add student error:', err);
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.style.cssText += 'color:var(--danger);padding:12px;background:#fee2e2;border-radius:8px;';
    document.getElementById('saveBtn').disabled = false;
  }
});