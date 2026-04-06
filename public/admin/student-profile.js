(async function () {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/admin/login.html';
    return;
  }

  const API_BASE = ''; // '' = same origin; or 'https://api.karumandelinkschool.ac.ke'

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    document.getElementById('studentName').textContent = 'Student ID missing';
    return;
  }

  // Show loading state
  const loadingEls = [document.getElementById('studentName'), document.getElementById('resultsList')];
  loadingEls.forEach(el => {
    if (el) el.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
  });

  let student;

  try {
    const res = await fetch(`${API_BASE}/api/students/dashboard/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store' // Prevent stale data for fees/results
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }

    const payload = await res.json();
    if (!payload.success) throw new Error(payload.message || 'No student data');

    student = payload.student;
    const s = student;

    // Populate basic info
    document.getElementById('studentName').textContent = s.name || 'Unknown Student';
    document.getElementById('admissionNumber').textContent = s.admissionNumber || 'N/A';
    document.getElementById('classLevel').textContent = s.classLevel || 'N/A'; // e.g., "Grade 5"
    document.getElementById('stream').textContent = s.stream || '-';

    if (s.parent) {
      document.getElementById('parentName').textContent = s.parent.name || '-';
      document.getElementById('parentEmail').textContent = s.parent.email || '-';
      document.getElementById('parentPhone').textContent = s.parent.phone || '-';
    }

    // Fees
    const fees = payload.fees || {};
    const summary = fees.summary || {};
    document.getElementById('totalBilled').textContent = (summary.totalBilled || 0).toLocaleString('en-KE', { style: 'currency', currency: 'KES' });
    document.getElementById('totalPaid').textContent = (summary.totalPaid || 0).toLocaleString('en-KE', { style: 'currency', currency: 'KES' });
    document.getElementById('balance').textContent = (summary.balance || 0).toLocaleString('en-KE', { style: 'currency', currency: 'KES' });

    // Recent bills (with KES formatting)
    const billsEl = document.getElementById('recentBills');
    billsEl.innerHTML = '<h4>Recent Bills</h4>';
    const bills = (fees.recentBills || []).slice(0, 5);
    if (!bills.length) {
      billsEl.innerHTML += '<p>No recent bills</p>';
    } else {
      const ul = document.createElement('ul');
      bills.forEach(b => {
        const li = document.createElement('li');
        li.innerHTML = `${b.term || 'Term ?'} - ${b.description || 'Fee'} → Billed: ${Number(b.amount || 0).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} | Paid: ${Number(b.amountPaid || 0).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} | Balance: ${Number(b.balance || 0).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} <a href="/admin/bill-details.html?studentId=${id}&billId=${b.id}">View/Edit</a>`;
        ul.appendChild(li);
      });
      billsEl.appendChild(ul);
    }

    // Recent payments (formatted dates)
    const paysEl = document.getElementById('recentPayments');
    paysEl.innerHTML = '<h4>Recent Payments</h4>';
    const pays = (fees.recentPayments || []).slice(0, 5);
    if (!pays.length) {
      paysEl.innerHTML += '<p>No recent payments</p>';
    } else {
      const ul = document.createElement('ul');
      pays.forEach(p => {
        const dateStr = p.date ? new Date(p.date).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
        const li = document.createElement('li');
        li.textContent = `${dateStr} - ${Number(p.amount || 0).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })} (${p.status || 'Unknown'})`;
        ul.appendChild(li);
      });
      paysEl.appendChild(ul);
    }

    // Results (CBC-style if available)
    const resultsEl = document.getElementById('resultsList');
    const results = (payload.results || []).slice(0, 10);
    if (!results.length) {
      resultsEl.textContent = 'No results recorded yet';
    } else {
      resultsEl.innerHTML = '';
      results.forEach(r => {
        const div = document.createElement('div');
        div.style.borderBottom = '1px solid #eee';
        div.style.padding = '8px 0';
        div.innerHTML = `<strong>${r.term || 'Term ?'}</strong> — Total Marks: ${r.totalMarks ?? r.total ?? '-'} | Grade: ${r.grade || '-'}<br>` +
                        `${(r.subjects || []).map(sub => `${sub.name}: ${sub.score}${sub.outOf ? '/' + sub.outOf : ''}`).join(' | ')}`;
        resultsEl.appendChild(div);
      });
    }

  } catch (err) {
    console.error('Student dashboard error:', err);
    document.getElementById('studentName').textContent = 'Error loading student';
    document.getElementById('resultsList').innerHTML = `<p style="color: var(--danger);">Failed: ${err.message}</p>`;
  }

  // Create bill button (now safe)
  const createBtn = document.getElementById('createBillBtn');
  if (createBtn && student) {
    createBtn.addEventListener('click', () => createBillForStudent(id, student.name || 'this student'));
  }
})();

// Improved createBill function (scoped better, uses API_BASE)
async function createBillForStudent(studentId, studentName) {
  const token = localStorage.getItem('token');
  if (!token) return;

  const API_BASE = ''; // match above

  try {
    // Load fee structures
    const fsRes = await fetch(`${API_BASE}/api/fee-structures`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!fsRes.ok) throw new Error('Cannot load fee structures');

    const feeStructures = await fsRes.json();
    const matches = (feeStructures || []).filter(f => f.classLevel === student.classLevel); // assumes student is in scope or fetch again if needed

    if (!matches.length) {
      alert("No matching fee structure for this student's class/level. Please create one in settings first.");
      return;
    }

    // Sort by most recent
    matches.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    const structure = matches[0];

    if (!confirm(`Create bill for ${studentName} using ${structure.term || 'current term'} fee structure (${Number(structure.amount || 0).toLocaleString('en-KE', { style: 'currency', currency: 'KES' })})?`)) {
      return;
    }

    const createRes = await fetch(`${API_BASE}/api/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        studentId,
        term: structure.term,
        amount: structure.amount,
        description: structure.description || 'Tuition / CBC Fees'
      })
    });

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({}));
      throw new Error(errData.message || 'Bill creation failed');
    }

    alert('Bill created successfully!');
    window.location.reload(); // Refresh to show new bill

  } catch (err) {
    console.error(err);
    alert(`Error: ${err.message}`);
  }
}

// Logout & back (unchanged, but add preventDefault if needed)
document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem('token');
  window.location.href = '/admin/login.html';
});

document.getElementById('backBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  history.back();
});