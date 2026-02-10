const token = localStorage.getItem('token');
if (!token) window.location.href = '/admin/login.html';

const elements = {
  logoutBtn: document.getElementById('logoutBtn'),
  body: document.getElementById('studentsBody'),
  search: document.getElementById('search'),
  searchBtn: document.getElementById('searchBtn')
};

// Logout
elements.logoutBtn?.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('adminToken'); // backwards-compat
  window.location.href = '/admin/login.html';
});

// Load students
async function loadStudents(query = '') {
  try {
    const url = query ? `/api/students?search=${encodeURIComponent(query)}` : '/api/students';
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to load students');
    const data = await res.json();
    renderStudents(data.data || data); // support both paginated and plain arrays
  } catch (err) {
    console.error(err);
    elements.body.innerHTML = `<tr><td colspan="5" style="color:red;text-align:center;">${err.message}</td></tr>`;
  }
}

// Render students grouped by class
function renderStudents(students) {
  if (!students.length) {
    elements.body.innerHTML = `<tr><td colspan="5" style="text-align:center;">No students found</td></tr>`;
    return;
  }

  // Group students by classLevel
  const groupedByClass = {};
  students.forEach(student => {
    const classLevel = student.classLevel || 'Unassigned';
    if (!groupedByClass[classLevel]) {
      groupedByClass[classLevel] = [];
    }
    groupedByClass[classLevel].push(student);
  });

  // Sort classes (you can customize this order)
  const classOrder = ['PlayGroup', 'PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 
                      'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Unassigned'];
  const sortedClasses = Object.keys(groupedByClass).sort((a, b) => {
    const indexA = classOrder.indexOf(a);
    const indexB = classOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // Build HTML with grouped sections
  let html = '';
  sortedClasses.forEach(classLevel => {
    const classStudents = groupedByClass[classLevel];
    // Add class header row
    html += `
      <tr style="background-color: #e3f2fd; font-weight: bold;">
        <td colspan="5" style="padding: 12px; font-size: 1.1em;">
          <i class="fa-solid fa-users"></i> ${classLevel} (${classStudents.length} student${classStudents.length !== 1 ? 's' : ''})
        </td>
      </tr>
    `;
    // Add students in this class
    classStudents.forEach(s => {
      html += `
        <tr>
          <td>${s.admissionNumber || 'N/A'}</td>
          <td>${s.name}</td>
          <td>${s.classLevel}</td>
          <td>${s.parent?.name || 'N/A'}</td>
          <td style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn view-btn" data-id="${s._id}">View</button>
            <a class="btn edit-btn" data-id="${s._id}" href="/admin/edit-student.html?id=${encodeURIComponent(s._id)}">Edit</a>
            <button class="btn fees-btn" data-id="${s._id}" data-name="${s.name}">Fees</button>
            <button class="btn delete-btn" data-id="${s._id}">Delete</button>
          </td>
        </tr>
      `;
    });
  });

  elements.body.innerHTML = html;

  // Attach event listeners to view buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      window.open(`/admin/student-profile.html?id=${id}`, '_blank');
    });
  });

  // Fees balance editor
  document.querySelectorAll('.fees-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const name = btn.dataset.name || 'Student';
      await openFeesEditor(id, name);
    });
  });

  // Delete (soft-delete) student
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!confirm('Delete this student? (This will remove them from active lists)')) return;
      try {
        const res = await fetch(`/api/students/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'Failed to delete student');
        await loadStudents(elements.search?.value?.trim() || '');
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function openFeesEditor(studentId, studentName) {
  try {
    const res = await fetch(`/api/bills?studentId=${encodeURIComponent(studentId)}&limit=1`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load student bills');
    const data = await res.json();
    const bills = data.data || data || [];
    const bill = bills[0];

    if (!bill) {
      alert('No fee bill found for this student. Create or generate a bill first.');
      return;
    }

    const currentBalance = Number(bill.balance ?? (Number(bill.amount || 0) - Number(bill.amountPaid || 0)));
    const termLabel = bill.term ? ` (${bill.term})` : '';
    const input = prompt(
      `Update fee balance for ${studentName}${termLabel}\nCurrent balance: ${currentBalance}`,
      String(currentBalance)
    );
    if (input === null) return;

    const nextBalance = Number(input);
    if (Number.isNaN(nextBalance) || nextBalance < 0) {
      alert('Enter a valid non-negative number.');
      return;
    }

    const patchRes = await fetch(`/api/bills/${encodeURIComponent(bill._id)}/adjust`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ balance: nextBalance })
    });
    const patchData = await patchRes.json().catch(() => ({}));
    if (!patchRes.ok) throw new Error(patchData.message || 'Failed to update balance');

    alert('Fee balance updated.');
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

// Search
elements.searchBtn?.addEventListener('click', () => {
  const q = elements.search.value.trim();
  loadStudents(q);
});

// Initial load
loadStudents();
