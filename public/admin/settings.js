// public/admin/settings.js
const token = localStorage.getItem('token');
if (!token) window.location.href = '/admin/login.html';

const API = '/api/settings';

async function loadSettings() {
  try {
    const res = await fetch(API, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to load settings');
    const data = await res.json();
    document.getElementById('schoolName').value = data.schoolName || '';
    document.getElementById('schoolAddress').value = data.schoolAddress || '';
    if (data.logoPath) document.getElementById('logoPreview').src = data.logoPath;
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('saveDetails').addEventListener('click', async (e) => {
  e.preventDefault();
  const body = {
    schoolName: document.getElementById('schoolName').value.trim(),
    schoolAddress: document.getElementById('schoolAddress').value.trim(),
  };
  try {
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Failed to save settings');
    alert('Settings saved');
  } catch (err) {
    alert('Error saving settings');
    console.error(err);
  }
});

document.getElementById('uploadLogo').addEventListener('click', async (e) => {
  e.preventDefault();
  const f = document.getElementById('logoFile').files[0];
  if (!f) return alert('Select a file');
  const fd = new FormData();
  fd.append('logo', f);
  try {
    const res = await fetch(API + '/logo', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    document.getElementById('logoPreview').src = data.path;
    document.getElementById('logoMsg').textContent = 'Logo uploaded';
  } catch (err) {
    document.getElementById('logoMsg').textContent = 'Upload error';
    console.error(err);
  }
});

loadSettings();
