const token = localStorage.getItem('token');
if (!token) window.location.href = '/admin/login.html';

const params = new URLSearchParams(window.location.search);
const studentId = params.get('studentId');
const billId = params.get('billId');

let student, structure, bill, pollInterval;

async function loadData() {
  try {
    // Fetch student
    const sRes = await fetch(`/api/students/${encodeURIComponent(studentId)}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!sRes.ok) throw new Error('Failed to load student');
    const sPayload = await sRes.json();
    student = sPayload.data || sPayload;
    document.getElementById('studentName').textContent = student.name;
    document.getElementById('admissionNumber').textContent = student.admissionNumber || '-';
    document.getElementById('classLevel').textContent = student.classLevel || '-';

    if (billId) {
      // View/Edit mode
      document.getElementById('pageTitle').textContent = 'Bill Details';
      document.getElementById('submitBtn').textContent = 'Update Bill';
      const bRes = await fetch(`/api/bills/${encodeURIComponent(billId)}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!bRes.ok) throw new Error('Failed to load bill');
      bill = await bRes.json();
      document.getElementById('term').textContent = bill.term;
      document.getElementById('amount').value = bill.amount;
      document.getElementById('description').value = bill.description || '';
      document.getElementById('amountPaid').textContent = bill.amountPaid;
      document.getElementById('balance').textContent = bill.balance;
      document.getElementById('status').textContent = bill.status;
      document.getElementById('billView').style.display = 'block';
      loadPayments();
      // Start polling for payment updates
      pollInterval = setInterval(loadPayments, 5000); // Poll every 5 seconds
    } else {
      // Create mode
      const fsRes = await fetch('/api/fee-structures', { headers: { Authorization: `Bearer ${token}` } });
      if (!fsRes.ok) throw new Error('Failed to load fee structures');
      const feeStructures = await fsRes.json();
      const matches = (feeStructures || []).filter(f => f.classLevel === student.classLevel);
      if (!matches.length) throw new Error('No fee structure for this class');
      matches.sort((a, b) => new Date(b.createdAt || b.updatedAt || Date.now()) - new Date(a.createdAt || a.updatedAt || Date.now()));
      structure = matches[0];
      document.getElementById('term').textContent = structure.term;
      document.getElementById('amount').value = structure.amount;
      document.getElementById('description').value = structure.description || 'Tuition';
    }
  } catch (err) {
    document.getElementById('billStatus').textContent = err.message;
    document.getElementById('billForm').style.display = 'none';
  }
}

async function loadPayments() {
  try {
    const pRes = await fetch(`/api/payments?billId=${encodeURIComponent(billId)}&limit=10`, { headers: { Authorization: `Bearer ${token}` } });
    if (!pRes.ok) throw new Error('Failed to load payments');
    const payments = await pRes.json();
    const list = document.getElementById('paymentsList');
    if (!payments.data || !payments.data.length) {
      list.textContent = 'No payments yet.';
    } else {
      list.innerHTML = '';
      payments.data.forEach(p => {
        const div = document.createElement('div');
        div.textContent = `${new Date(p.createdAt).toLocaleString()} - ${p.amount} (${p.status})`;
        list.appendChild(div);
      });
    }
  } catch (err) {
    document.getElementById('paymentsList').textContent = 'Error loading payments.';
  }
}

// Form submit
const billForm = document.getElementById('billForm');
billForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const amount = Number(document.getElementById('amount').value);
    const description = document.getElementById('description').value;
    let res, data;
    if (billId) {
      // Update
      res = await fetch(`/api/bills/${encodeURIComponent(billId)}/adjust`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, description })
      });
      data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update bill');
      document.getElementById('billStatus').textContent = 'Bill updated!';
    } else {
      // Create
      const term = structure.term;
      res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ studentId, term, amount, description })
      });
      data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create bill');
      document.getElementById('billStatus').textContent = 'Bill created! Redirecting...';
      setTimeout(() => {
        window.location.href = `/admin/student-profile.html?id=${studentId}`;
      }, 1200);
    }
  } catch (err) {
    document.getElementById('billStatus').textContent = err.message;
  }
});

// Cleanup polling on unload
window.addEventListener('beforeunload', () => {
  if (pollInterval) clearInterval(pollInterval);
});

window.addEventListener('load', loadData);
