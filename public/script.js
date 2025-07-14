const form = document.getElementById('studentForm');
const studentsTableBody = document.querySelector('#studentsTable tbody');
const API_URL = "https://karumande-api.onrender.com/api/students";

// ==================== Submit Student Form ====================
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value.trim();
  const studentClass = document.getElementById('class').value.trim();
  const email = document.getElementById('email').value.trim();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, class: studentClass, email })
    });

    const data = await response.json();
    alert(data.message || 'Student registered.');
    form.reset();
    loadStudents();
  } catch (err) {
    alert("Registration failed: " + err.message);
  }
});

// ==================== Load All Students ====================
async function loadStudents() {
  try {
    const res = await fetch(API_URL);
    const students = await res.json();

    studentsTableBody.innerHTML = ''; // clear table

    students.forEach(student => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${student.name}</td>
        <td>${student.class}</td>
        <td>${student.email}</td>
        <td>
          <button class="delete-btn" onclick="deleteStudent(${student.id})">Delete</button>
        </td>
      `;
      studentsTableBody.appendChild(row);
    });
  } catch (err) {
    alert("Error loading students: " + err.message);
  }
}

// ==================== Delete Student ====================
async function deleteStudent(id) {
  if (!confirm('Are you sure you want to delete this student?')) return;

  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE'
    });

    const data = await res.json();
    alert(data.message);
    loadStudents();
  } catch (err) {
    alert("Delete failed: " + err.message);
  }
}

// ==================== Fetch Students for Dashboard Cards ====================
async function fetchStudents() {
  try {
    const res = await fetch(API_URL);
    const students = await res.json();

    const list = document.getElementById("students-list");
    if (list) {
      list.innerHTML = ""; // Clear first

      students.forEach((student) => {
        const div = document.createElement("div");
        div.className = "col";
        div.innerHTML = `
          <div class="student-card">
            <h5>${student.name}</h5>
            <p>Class: ${student.class}</p>
            <p>Email: <a href="mailto:${student.email}">${student.email}</a></p>
          </div>
        `;
        list.appendChild(div);
      });
    }
  } catch (err) {
    alert("Failed to load students: " + err.message);
  }
}

// ==================== Logout ====================
function logout() {
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

// ==================== Highlight Nav and Init ====================
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.includes('index.html')) {
    document.getElementById('home-link')?.classList.add('active');
  } else if (path.includes('register.html')) {
    document.getElementById('register-link')?.classList.add('active');
  }

  // Burger menu
  document.addEventListener('DOMContentLoaded', () => {
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav-links');

  if (burger && nav) {
    burger.addEventListener('click', () => {
      nav.classList.toggle('show');
    });
  }
});


  // Check login
  document.addEventListener('DOMContentLoaded', () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) {
    window.location.href = "login.html"; // 🔐 Redirect if not logged in
    return;
  }

  document.getElementById("user-greeting").textContent = `Welcome, ${user.username || user.email}!`;
  fetchStudents(); // Load student cards
});

function logout() {
  localStorage.removeItem("user");
  window.location.href = "login.html";
}
  loadStudents(); // Load students on page load
})
