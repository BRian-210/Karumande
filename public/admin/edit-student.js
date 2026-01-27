(function () {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/admin/login.html';
    return;
  }

  const msgEl = document.getElementById('msg');
  const loadingEl = document.getElementById('loading');
  const saveBtn = document.getElementById('saveBtn');

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    msgEl.textContent = 'Missing student id.';
    msgEl.style.color = 'crimson';
    saveBtn.disabled = true;
    return;
  }

  function setMsg(text, color = '') {
    msgEl.textContent = text;
    msgEl.style.color = color;
  }

  function toDateInputValue(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  async function loadStudent() {
    loadingEl.style.display = 'block';
    try {
      const res = await fetch(`/api/students/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Failed to load student');

      const s = body.data;
      document.getElementById('name').value = s.name || '';
      document.getElementById('classLevel').value = s.classLevel || 'Grade 1';
      document.getElementById('admissionNumber').value = s.admissionNumber || '';
      document.getElementById('dob').value = toDateInputValue(s.dob);
      document.getElementById('gender').value = s.gender || 'Male';
      document.getElementById('parentId').value = s.parent?._id || s.parent || '';
    } catch (err) {
      setMsg(err.message, 'crimson');
      saveBtn.disabled = true;
    } finally {
      loadingEl.style.display = 'none';
    }
  }

  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    setMsg('');

    const payload = {
      name: document.getElementById('name').value.trim(),
      classLevel: document.getElementById('classLevel').value,
      admissionNumber: document.getElementById('admissionNumber').value.trim() || undefined,
      dob: document.getElementById('dob').value || undefined,
      gender: document.getElementById('gender').value,
      parentId: document.getElementById('parentId').value.trim() || undefined,
    };

    if (!payload.name) {
      setMsg('Name is required.', 'crimson');
      return;
    }
    if (!payload.dob) {
      setMsg('DOB is required.', 'crimson');
      return;
    }

    try {
      const res = await fetch(`/api/students/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg =
          body?.message || (body?.errors && body.errors[0]?.msg) || 'Failed to save changes';
        throw new Error(errMsg);
      }
      setMsg('Student updated successfully.', 'green');
    } catch (err) {
      setMsg(err.message, 'crimson');
    }
  });

  loadStudent();
})();


