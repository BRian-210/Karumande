require('dotenv').config(); // Load .env variables

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

let students = []; // In-memory student store
let bills = []; // In-memory store for billing records
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
  email,
  password
});
  sendConfirmationEmail(newStudent);

  res.status(201).json({ message: 'Student registered successfully.', student: newStudent });
});

// === Login Endpoint ===
app.post('/api/login', (req, res) => {
const { email, password } = req.body;

const user = users.find(
  (u) => u.email === email && u.password === password
);
  if (!user) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  res.json({ message: 'Login successful', user: { id: user.id, email: user.email } });
});

// === Get All Students ===
app.get('/api/students', (req, res) => {
  res.json(students);
});
// === Billing Endpoints ===

// Create a bill
app.post('/api/bills', (req, res) => {
  const { name, description, amount } = req.body;

  if (!name || !description || typeof amount !== 'number') {
    return res.status(400).json({ message: 'Name, description, and numeric amount are required.' });
  }

  const newBill = {
    id: bills.length + 1,
    name,
    description,
    amount
  };

  bills.push(newBill);
  res.status(201).json(newBill);
});

// Get all bills
app.get('/api/bills', (req, res) => {
  res.json(bills);
});

// Delete a bill
app.delete('/api/bills/:id', (req, res) => {
  const billId = parseInt(req.params.id);
  const index = bills.findIndex(bill => bill.id === billId);

  if (index === -1) {
    return res.status(404).json({ message: 'Bill not found' });
  }

  bills.splice(index, 1);
  res.json({ message: 'Bill deleted successfully' });
});

// === Start Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
