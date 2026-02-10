const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/login.html';
}

let currentStudent = null;

function logout() {
  if (confirm('Are you sure you want to log out?')) {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
  }
}

// Load student data on page load
document.addEventListener('DOMContentLoaded', loadStudentData);
document.addEventListener('DOMContentLoaded', loadDashboardAnnouncements);

async function loadStudentData() {
  try {
    // First get the current user's students
    const studentsRes = await fetch('/api/students', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!studentsRes.ok) {
      const errorText = await studentsRes.text();
      console.error('Students API response:', studentsRes.status, errorText);
      throw new Error(`Failed to load students: ${studentsRes.status} ${errorText}`);
    }

    if (studentsRes.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login.html';
      return;
    }

    if (!studentsRes.ok) {
      const errorText = await studentsRes.text();
      console.error('Students API response:', studentsRes.status, errorText);
      throw new Error(`Failed to load students: ${studentsRes.status} ${errorText}`);
    }

    const studentsData = await studentsRes.json();
    const students = studentsData.data || studentsData;

    if (!students || students.length === 0) {
      showMessage('No students found associated with this account. Please contact the school administration.', 'error');
      // Hide loading states
      document.getElementById('feesTableBody').innerHTML = '<tr><td colspan="5" style="text-align: center;">No students found</td></tr>';
      document.getElementById('resultsTableBody').innerHTML = '<tr><td colspan="5" style="text-align: center;">No students found</td></tr>';
      const paymentsBody = document.getElementById('paymentsTableBody');
      if (paymentsBody) {
        paymentsBody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No students found</td></tr>';
      }
      return;
    }

    // For now, load the first student's data (in future could have multiple students)
    const studentId = students[0]._id;
    currentStudent = students[0];

    // Load dashboard data for this student
    const dashboardRes = await fetch(`/api/students/dashboard/${studentId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!dashboardRes.ok) {
      throw new Error('Failed to load dashboard data');
    }

    const dashboardData = await dashboardRes.json();

    // Update UI with student data
    updateStudentInfo(dashboardData);
    updateFeesTable(dashboardData.fees);
    updatePaymentsTable(dashboardData.fees);
    updateResultsTable(dashboardData.results);
    updatePaymentSection(dashboardData);

  } catch (err) {
    console.error('Load dashboard error:', err);
    showMessage(`Error loading dashboard: ${err.message}`, 'error');
  }
}

function updateStudentInfo(data) {
  document.getElementById('studentName').textContent = data.student.name;
  document.getElementById('studentClass').textContent = data.student.classLevel;
  document.getElementById('studentAdmission').textContent = data.student.admissionNumber;

  // Update fee balance card
  const balance = Number(data.fees.summary?.balance || 0);
  document.getElementById('feeBalance').textContent =
    balance <= 0 ? 'Cleared' : `KES ${balance.toLocaleString()}`;

  const statusElement = document.getElementById('feeStatus');
  const status = data.fees.summary?.status || (balance <= 0 ? 'paid' : 'unknown');
  statusElement.textContent = formatStatusLabel(status, balance);
  statusElement.className = `badge ${status}`;
}

function updateFeesTable(fees) {
  const tbody = document.getElementById('feesTableBody');

  if (!fees || !fees.recentBills || fees.recentBills.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No fee records found</td></tr>';
    return;
  }

  const rows = fees.recentBills.map(bill => {
    const amount = Number(bill.amount || 0);
    const amountPaid = Number(bill.amountPaid || 0);
    const balance = Number(bill.balance ?? Math.max(amount - amountPaid, 0));
    const status = bill.status || (balance <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'pending');

    return `
      <tr>
        <td>${bill.term || '—'}</td>
        <td>KES ${amount.toLocaleString()}</td>
        <td>KES ${amountPaid.toLocaleString()}</td>
        <td>${balance <= 0 ? 'Cleared' : `KES ${balance.toLocaleString()}`}</td>
        <td><span class="badge ${status}">${formatStatusLabel(status, balance)}</span></td>
      </tr>
    `;
  });

  tbody.innerHTML = rows.join('');
}

function updateResultsTable(results) {
  const tbody = document.getElementById('resultsTableBody');

  if (!results || results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No results found</td></tr>';
    return;
  }

  const rows = [];
  results.forEach(result => {
    if (result.subjects && result.subjects.length > 0) {
      result.subjects.forEach(subject => {
        const grade = calculateGrade(subject.score);
        const remarks = getRemarks(subject.score);
        rows.push(`
          <tr>
            <td>${result.term}</td>
            <td>${subject.name}</td>
            <td>${subject.score}/${subject.maxScore || 100}</td>
            <td>${grade}</td>
            <td>${remarks}</td>
          </tr>
        `);
      });
    }
  });

  tbody.innerHTML = rows.length > 0 ? rows.join('') :
    '<tr><td colspan="5" style="text-align: center;">No subject results found</td></tr>';
}

function updatePaymentSection(data) {
  const paymentSection = document.getElementById('paymentSection');
  paymentSection.style.display = 'block';

  // Update paybill account references
  const studentName = data.student.name;
  const classLevel = data.student.classLevel;
  const accountRef = `${studentName} ${classLevel}`.replace(/\s+/g, ' ');

  document.getElementById('equityAccount').textContent = accountRef;
  document.getElementById('kcbAccount').textContent = `6351744#${accountRef.replace(/\s+/g, '')}`;
  document.getElementById('fortuneAccount').textContent = `70643#${accountRef}`;

  // Set up paybill selection handler
  const paybillSelect = document.getElementById('paybillSelect');
  paybillSelect.addEventListener('change', () => updateSelectedPaybillInfo(accountRef));

  // Initialize with default selection
  updateSelectedPaybillInfo(accountRef);

  // Set up payment button
  document.getElementById('payBtn').addEventListener('click', () => initiatePayment(data.student.id));
}

function updateSelectedPaybillInfo(accountRef) {
  const paybillSelect = document.getElementById('paybillSelect');
  const selectedValue = paybillSelect.value;
  const selectedPaybillName = paybillSelect.options[paybillSelect.selectedIndex].text;
  const selectedAccountRef = document.getElementById('selectedAccountRef');

  document.getElementById('selectedPaybillName').textContent = selectedPaybillName;

  if (selectedValue === 'equity') {
    selectedAccountRef.textContent = accountRef;
  } else if (selectedValue === 'kcb') {
    selectedAccountRef.textContent = `6351744#${accountRef.replace(/\s+/g, '')}`;
  } else if (selectedValue === 'fortune') {
    selectedAccountRef.textContent = `70643#${accountRef}`;
  }
}

async function initiatePayment(studentId) {
  const phoneInput = document.getElementById('paymentPhone');
  const amountInput = document.getElementById('paymentAmount');

  const phone = phoneInput.value.trim();
  const amount = parseFloat(amountInput.value);

  if (!phone || !amount || amount <= 0) {
    showMessage('Please enter valid phone number and amount', 'error');
    return;
  }

  // Basic phone validation
  if (!/^254[0-9]{9}$/.test(phone)) {
    showMessage('Please enter phone number in format: 254712345678', 'error');
    return;
  }

  try {
    const response = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        studentId,
        phone,
        amount
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Payment initiation failed');
    }

    const result = await response.json();
    showMessage('STK Push sent! Check your phone to complete payment.', 'success');

    // Clear form
    phoneInput.value = '';
    amountInput.value = '';

    // Reload data after a delay to show updated balance
    setTimeout(() => loadStudentData(), 5000);

  } catch (err) {
    console.error('Payment error:', err);
    showMessage(`Payment failed: ${err.message}`, 'error');
  }
}

function updatePaymentsTable(fees) {
  const tbody = document.getElementById('paymentsTableBody');
  if (!fees || !fees.recentPayments || fees.recentPayments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No payments found</td></tr>';
    return;
  }

  tbody.innerHTML = fees.recentPayments.map(p => {
    const date = p.date ? new Date(p.date).toLocaleDateString() : '—';
    const status = (p.status || 'unknown').toLowerCase();
    return `
      <tr>
        <td>${date}</td>
        <td>KES ${Number(p.amount || 0).toLocaleString()}</td>
        <td>${p.method || 'Unknown'}</td>
        <td><span class="badge ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
      </tr>
    `;
  }).join('');
}

function formatStatusLabel(status, balance = null) {
  if (balance !== null && Number(balance) <= 0) return 'Cleared';
  const key = (status || '').toLowerCase();
  if (key === 'paid') return 'Cleared';
  if (key === 'partial-low') return 'Partial (Low)';
  if (key === 'partial') return 'Partial';
  if (key === 'high') return 'High Balance';
  if (key === 'outstanding') return 'Outstanding';
  if (key === 'pending') return 'Pending';
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : '—';
}

function calculateGrade(score) {
  const percentage = (score / 100) * 100;
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'A-';
  if (percentage >= 75) return 'B+';
  if (percentage >= 70) return 'B';
  if (percentage >= 65) return 'B-';
  if (percentage >= 60) return 'C+';
  if (percentage >= 55) return 'C';
  if (percentage >= 50) return 'C-';
  if (percentage >= 45) return 'D+';
  if (percentage >= 40) return 'D';
  return 'E';
}

function getRemarks(score) {
  const percentage = (score / 100) * 100;
  if (percentage >= 90) return 'Excellent!';
  if (percentage >= 80) return 'Very Good';
  if (percentage >= 70) return 'Good';
  if (percentage >= 60) return 'Fair';
  if (percentage >= 50) return 'Needs Improvement';
  return 'Poor Performance';
}

function showMessage(text, type = 'info') {
  // Create a temporary message element
  const messageEl = document.createElement('div');
  messageEl.className = `message ${type}`;
  messageEl.textContent = text;
  messageEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 1000;
    max-width: 400px;
  `;

  // Set background color based on type
  if (type === 'success') messageEl.style.backgroundColor = '#10b981';
  else if (type === 'error') messageEl.style.backgroundColor = '#ef4444';
  else messageEl.style.backgroundColor = '#3b82f6';

  document.body.appendChild(messageEl);

  setTimeout(() => {
    if (messageEl.parentNode) {
      messageEl.parentNode.removeChild(messageEl);
    }
  }, 5000);
}

async function loadDashboardAnnouncements() {
  try {
    const response = await fetch('/api/announcements?limit=10');
    if (!response.ok) throw new Error('Failed to fetch announcements');

    const data = await response.json();
    const announcements = data.data || [];

    const container = document.getElementById('dashboardAnnouncementsContainer');
    if (!container) return;

    if (announcements.length === 0) {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--muted);"><p>No announcements at the moment.</p></div>';
      return;
    }

    container.innerHTML = announcements.map(announcement => `
      <div class="announcement">
        <strong>${announcement.title}</strong>
        <p>${announcement.body}</p>
        <small style="color: var(--muted);">${new Date(announcement.createdAt).toLocaleDateString()}</small>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading announcements:', err);
    const container = document.getElementById('dashboardAnnouncementsContainer');
    if (container) {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--muted);"><p>Could not load announcements.</p></div>';
    }
  }
}
