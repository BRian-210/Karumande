if (!localStorage.getItem('token')) window.location.href = '/admin/login.html';

const token = localStorage.getItem('token');
const msgEl = document.getElementById('msg');

document.getElementById('saveBtn').addEventListener('click', async (e) => {
  e.preventDefault();

  msgEl.textContent = '';
  msgEl.style.color = '';

  const payload = {
    name: document.getElementById('name').value.trim(),
    classLevel: document.getElementById('classLevel').value,
    admissionNumber: document.getElementById('admissionNumber').value.trim(),
    dob: document.getElementById('dob').value || undefined,
    gender: document.getElementById('gender').value,
    parentId: document.getElementById('parentId').value.trim() || undefined
  };

  if (!payload.name || !payload.classLevel) {
    msgEl.textContent = 'Please fill in the student name and class.';
    msgEl.style.color = 'crimson';
    return;
  }

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
      const errMsg =
        data?.message ||
        (data?.errors && data.errors[0]?.msg) ||
        'Failed to create student';
      throw new Error(errMsg);
    }

    msgEl.textContent = 'Student created successfully.';
    msgEl.style.color = 'green';

    // Optional: redirect to list so the new student is visible under their class
    setTimeout(() => {
      window.location.href = '/admin/students-list.html';
    }, 1000);
  } catch (err) {
    msgEl.textContent = 'Error: ' + err.message;
    msgEl.style.color = 'crimson';
  }
});