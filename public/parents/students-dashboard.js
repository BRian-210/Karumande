const token = localStorage.getItem('token');
if (!token) {
  window.location.href = '/parents/login.html';
}

let currentStudent = null;

function logout() {
  if (confirm('Are you sure you want to log out?')) {
    localStorage.removeItem('token');
    window.location.href = '/parents/login.html';
  }
}

// Load student data on page load
document.addEventListener('DOMContentLoaded', loadStudentData);
document.addEventListener('DOMContentLoaded', loadDashboardAnnouncements);
document.addEventListener('DOMContentLoaded', setupMenu);

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
      window.location.href = '/parents/login.html';
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
  const balance = data.fees.balance;
  document.getElementById('feeBalance').textContent = `KES ${balance.toLocaleString()}`;

  const statusElement = document.getElementById('feeStatus');
  const status = data.fees.status;
  statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
  statusElement.className = `badge ${status}`;
}

function updateFeesTable(fees) {
  const tbody = document.getElementById('feesTableBody');

  if (!fees.bills || fees.bills.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No fee records found</td></tr>';
    return;
  }

  // Group bills by term
  const termGroups = {};
  fees.bills.forEach(bill => {
    if (!termGroups[bill.term]) {
      termGroups[bill.term] = { total: 0, bills: [] };
    }
    termGroups[bill.term].total += bill.amount;
    termGroups[bill.term].bills.push(bill);
  });

  const rows = Object.entries(termGroups).map(([term, data]) => {
    const paidForTerm = fees.payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const balance = data.total - paidForTerm;
    const status = balance <= 0 ? 'paid' : balance < data.total * 0.5 ? 'partial' : 'unpaid';

    return `
      <tr>
        <td>${term}</td>
        <td>KES ${data.total.toLocaleString()}</td>
        <td>KES ${paidForTerm.toLocaleString()}</td>
        <td>KES ${balance.toLocaleString()}</td>
        <td><span class="badge ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
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

  // Set up payment button
  document.getElementById('payBtn').addEventListener('click', () => initiatePayment(data.student.id));
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

function setupMenu() {
  const menuToggle = document.getElementById('menuToggle');
  const portalMenu = document.getElementById('portalMenu');
  const logoutBtn = document.getElementById('logoutBtn');
  const menuLogout = document.getElementById('menuLogout');

  logoutBtn?.addEventListener('click', logout);
  menuLogout?.addEventListener('click', logout);

  menuToggle?.addEventListener('click', () => {
    const isOpen = portalMenu?.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(!!isOpen));
  });

  document.addEventListener('click', (event) => {
    if (!portalMenu || !menuToggle) return;
    if (portalMenu.contains(event.target) || menuToggle.contains(event.target)) return;
    portalMenu.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  });
}
