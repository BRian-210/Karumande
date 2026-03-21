(async function(){
  const token = localStorage.getItem('token');
  if (!token) return;

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  if (!id) {
    document.getElementById('studentName').textContent = 'Student not specified';
    return;
  }

  try {
    const res = await fetch(`/api/students/dashboard/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load student');
    const payload = await res.json();
    if (!payload.success) throw new Error(payload.message || 'No data');

    const s = payload.student;
    document.getElementById('studentName').textContent = s.name || 'Student';
    document.getElementById('admissionNumber').textContent = s.admissionNumber || 'N/A';
    document.getElementById('classLevel').textContent = s.classLevel || 'N/A';
    document.getElementById('stream').textContent = s.stream || '-';

    if (s.parent) {
      document.getElementById('parentName').textContent = s.parent.name || '-';
      document.getElementById('parentEmail').textContent = s.parent.email || '-';
      document.getElementById('parentPhone').textContent = s.parent.phone || '-';
    }

    const fees = payload.fees || {};
    const summary = fees.summary || {};
    document.getElementById('totalBilled').textContent = summary.totalBilled ?? 0;
    document.getElementById('totalPaid').textContent = summary.totalPaid ?? 0;
    document.getElementById('balance').textContent = summary.balance ?? 0;

    // Recent bills
    const billsEl = document.getElementById('recentBills');
    billsEl.innerHTML = '<h4>Recent Bills</h4>';
    const bills = (fees.recentBills || []).slice(0,5);
    if (!bills.length) billsEl.innerHTML += '<p>No bills</p>';
    else {
      const ul = document.createElement('ul');
      bills.forEach(b => {
        const li = document.createElement('li');
        li.textContent = `${b.term || ''} - ${b.description || ''}: amount ${b.amount} paid ${b.amountPaid} balance ${b.balance}`;
        ul.appendChild(li);
      });
      billsEl.appendChild(ul);
    }

    // Recent payments
    const paysEl = document.getElementById('recentPayments');
    paysEl.innerHTML = '<h4>Recent Payments</h4>';
    const pays = (fees.recentPayments || []).slice(0,5);
    if (!pays.length) paysEl.innerHTML += '<p>No payments</p>';
    else {
      const ul = document.createElement('ul');
      pays.forEach(p => {
        const li = document.createElement('li');
        li.textContent = `${p.date ? new Date(p.date).toLocaleString() : ''} - ${p.amount} (${p.status})`;
        ul.appendChild(li);
      });
      paysEl.appendChild(ul);
    }

    // Results
    const resultsEl = document.getElementById('resultsList');
    const results = (payload.results || []).slice(0,10);
    if (!results.length) resultsEl.textContent = 'No results available';
    else {
      resultsEl.innerHTML = '';
      results.forEach(r => {
        const div = document.createElement('div');
        div.style.borderBottom = '1px solid #eee';
        div.style.padding = '8px 0';
        div.innerHTML = `<strong>${r.term}</strong> — Total: ${r.totalMarks || r.total || '-'} Grade: ${r.grade || '-'}<br>` +
                        `${(r.subjects || []).map(s => `${s.name}: ${s.score}`).join(' | ')}`;
        resultsEl.appendChild(div);
      });
    }

  } catch (err) {
    console.error(err);
    document.getElementById('studentName').textContent = 'Failed to load student';
    document.getElementById('resultsList').textContent = err.message;
  }
})();
