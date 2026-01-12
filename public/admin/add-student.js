if (!localStorage.getItem('token')) window.location.href = '/admin/login.html';
      const token = localStorage.getItem('token');
      document.getElementById('saveBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('name').value.trim(),
          classLevel: document.getElementById('classLevel').value,
          admissionNumber: document.getElementById('admissionNumber').value.trim(),
          dob: document.getElementById('dob').value || undefined,
          gender: document.getElementById('gender').value,
          parentId: document.getElementById('parentId').value.trim() || undefined
        };
        try {
          const res = await fetch('/api/students', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload)
          });
          if (!res.ok) {
            const err = await res.json().catch(()=>({}));
            throw new Error(err.message || 'Failed');
          }
          const data = await res.json();
          document.getElementById('msg').textContent = 'Student created';
        } catch (err) {
          document.getElementById('msg').textContent = 'Error: ' + err.message;
          document.getElementById('msg').style.color = 'crimson';
        }
      });