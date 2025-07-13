const form = document.getElementById('studentForm');
const studentsTableBody = document.querySelector('#studentsTable tbody');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('name').value;
  const studentClass = document.getElementById('class').value;
  const email = document.getElementById('email').value;

  const response = await fetch('http://localhost:3000/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, class: studentClass, email })
  });

  const data = await response.json();
  alert(data.message || 'Student registered.');
  form.reset();
  loadStudents();
});

async function loadStudents() {
  const res = await fetch('http://localhost:3000/api/students');
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
}

async function deleteStudent(id) {
  if (!confirm('Are you sure you want to delete this student?')) return;

  const res = await fetch(`http://localhost:3000/api/students/${id}`, {
    method: 'DELETE'
  });

  const data = await res.json();
  alert(data.message);
  loadStudents();
}

// Load students on page load
loadStudents();
// Highlight the current page in the nav
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.includes('index.html')) {
    document.getElementById('home-link')?.classList.add('active');
  } else if (path.includes('register.html')) {
    document.getElementById('register-link')?.classList.add('active');
  }
});
// This script handles student registration and displays the list of registered students.
// It listens for form submissions, sends data to the server, and updates the student list dynamically
// Highlight nav link
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.includes('index.html')) {
    document.getElementById('home-link')?.classList.add('active');
  } else if (path.includes('register.html')) {
    document.getElementById('register-link')?.classList.add('active');
  }
  // Burger menu
  const burger = document.getElementById('burger');
  const nav = document.getElementById('nav-links');
  if (burger && nav) {
    burger.addEventListener('click', () => {
      nav.classList.toggle('show');
    });
  }
   // Check login
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user) {
      window.location.href = "login.html";
    }

    document.getElementById("user-greeting").textContent = `Hello, ${user.username}!`;

    // Fetch and display students
    async function fetchStudents() {
      try {
        const res = await fetch("http://localhost:3000/api/students");
        const students = await res.json();

        const list = document.getElementById("students-list");
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

      } catch (err) {
        alert("Failed to load students: " + err.message);
      }
    }

    fetchStudents();

    // Logout
    function logout() {
      localStorage.removeItem("user");
      window.location.href = "login.html";
    }
});
