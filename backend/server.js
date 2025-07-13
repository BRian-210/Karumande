require('dotenv').config(); // Load .env variables

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

let students = []; // In-memory student store
let users = [];    // Registered users (in-memory)

// === Email Sending Function ===
function sendConfirmationEmail(student) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,   // from .env
      pass: process.env.EMAIL_PASS    // from .env
    }
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: student.email,
    subject: 'Student Registration Confirmation',
    text: `Hi ${student.name},\n\nThank you for registering for class ${student.class}!\n\n- School Team`
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('❌ Email failed:', err.message);
    } else {
      console.log('✅ Email sent:', info.response);
    }
  });
}

// === Register Student (with password) ===
app.post('/api/students', (req, res) => {
  const { name, class: studentClass, email, password } = req.body;

  if (!name || !studentClass || !email || !password) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  const exists = students.find((s) => s.email === email);
  if (exists) {
    return res.status(409).json({ message: 'Student with this email already exists.' });
  }

  const newStudent = {
    id: students.length + 1,
    name,
    class: studentClass,
    email,
    password // ❗ Passwords should be hashed in production
  };

  students.push(newStudent);

  // Also register user for login
  users.push({
    id: users.length + 1,
    username: email,
    password
  });

  sendConfirmationEmail(newStudent);

  res.status(201).json({ message: 'Student registered successfully.', student: newStudent });
});

// === Login Endpoint ===
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  res.json({ message: 'Login successful', user: { id: user.id, username: user.username } });
});

// === Get All Students ===
app.get('/api/students', (req, res) => {
  res.json(students);
});

// === Start Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
