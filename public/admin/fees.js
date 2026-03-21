const token = localStorage.getItem('token');
if (!token) window.location.href = '/admin/login.html';

async function loadFeeStructures() {
  try {
    const res = await fetch('/api/fee-structures', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to load fee structures');
    const structures = await res.json();
    renderTable(structures);
  } catch (err) {
    console.error(err);
    document.getElementById('feeTableBody').innerHTML = `<tr><td colspan="4">${err.message}</td></tr>`;
  }
}

function renderTable(structures) {
  const tbody = document.getElementById('feeTableBody');
  tbody.innerHTML = '';
  structures.forEach(s => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${s.classLevel}</td>
      <td>${s.term}</td>
      <td><input type="number" value="${s.amount}" data-id="${s._id}" class="amount-input" /></td>
      <td><input type="text" value="${s.description || ''}" data-id="${s._id}" class="desc-input" /></td>
      <td><button class="btn btn-primary" onclick="updateStructure('${s._id}')">Update</button></td>
    `;
    tbody.appendChild(row);
  });
}

async function updateStructure(id) {
  const row = document.querySelector(`input[data-id="${id}"]`).closest('tr');
  const amount = row.querySelector('.amount-input').value;
  const description = row.querySelector('.desc-input').value;
  try {
    const res = await fetch(`/api/fee-structures/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount: Number(amount), description })
    });
    if (!res.ok) throw new Error('Failed to update');
    alert('Updated successfully');
  } catch (err) {
    alert(err.message);
  }
}

async function addStructure() {
  const classLevel = document.getElementById('newClass').value;
  const term = document.getElementById('newTerm').value;
  const amount = document.getElementById('newAmount').value;
  const description = document.getElementById('newDesc').value;
  try {
    const res = await fetch('/api/fee-structures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ classLevel, term, amount: Number(amount), description })
    });
    if (!res.ok) throw new Error('Failed to add');
    alert('Added successfully');
    loadFeeStructures();
  } catch (err) {
    alert(err.message);
  }
}

window.addEventListener('load', loadFeeStructures);