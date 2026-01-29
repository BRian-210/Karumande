require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Student = require('../src/models/Student');
const Bill = require('../src/models/Bill');
const Result = require('../src/models/Result');
const Payment = require('../src/models/Payment');
const Announcement = require('../src/models/Announcement');
const GalleryImage = require('../src/models/GalleryImage');

mongoose.connect(process.env.MONGO_URI);

async function createTestData() {
  try {
    console.log('Creating test data...');

    // Create a test parent
    const parentEmail = 'parent@test.com';
    let parent = await User.findOne({ email: parentEmail });

    if (!parent) {
      parent = await User.create({
        name: 'Test Parent',
        email: parentEmail,
        passwordHash: 'password123', // Will be hashed by model
        role: 'parent',
        mustChangePassword: false,
        isActive: true
      });
      console.log('✅ Test parent created');
    }

    // Create a test student
    const admissionNumber = 'ADM/2025/001';
    let student = await Student.findOne({ admissionNumber });

    if (!student) {
      student = await Student.create({
        name: 'Test Student',
        admissionNumber,
        classLevel: 'Grade 1',
        gender: 'Male',
        dob: new Date('2018-01-01'),
        parent: parent._id,
        active: true
      });
      console.log('✅ Test student created');
    }

    // Create some bills for the student
    const existingBills = await Bill.countDocuments({ student: student._id });
    if (existingBills === 0) {
      await Bill.create([
        {
          student: student._id,
          description: 'Term 1 2025 Tuition',
          amount: 15000,
          term: 'Term 1',
          dueDate: new Date('2025-02-01')
        },
        {
          student: student._id,
          description: 'Term 1 2025 Meals',
          amount: 2200,
          term: 'Term 1',
          dueDate: new Date('2025-02-01')
        }
      ]);
      console.log('✅ Test bills created');
    }

    // Create a payment for the student
    const Payment = require('../src/models/Payment');
    const existingPayments = await Payment.countDocuments({ student: student._id });
    if (existingPayments === 0) {
      await Payment.create({
        student: student._id,
        amount: 10000,
        phone: '254712345678',
        status: 'success',
        createdAt: new Date('2025-01-15')
      });
      console.log('✅ Test payment created');
    }

    // Create some results for the student
    const existingResults = await Result.countDocuments({ student: student._id });
    if (existingResults === 0) {
      await Result.create({
        student: student._id,
        term: 'Term 1',
        year: 2025,
        subjects: [
          { name: 'Mathematics', score: 85, maxScore: 100 },
          { name: 'English', score: 78, maxScore: 100 },
          { name: 'Science', score: 82, maxScore: 100 }
        ],
        total: 245,
        grade: 'B+'
      });
      console.log('✅ Test results created');
    }

    // Create test announcements
    const existingAnnouncements = await Announcement.countDocuments();
    if (existingAnnouncements === 0) {
      await Announcement.create([
        {
          title: 'School Reopening – Term 1 2026',
          body: 'School reopens on January 8th, 2026. All students are expected to report on time. Ensure school fees are cleared before resumption.',
          audience: 'public',
          active: true
        },
        {
          title: 'Parents Meeting',
          body: 'A general parents meeting is scheduled for Friday, January 17th at 2:00 PM in the school hall. Attendance is highly encouraged to discuss your child\'s progress and school updates.',
          audience: 'parents',
          active: true
        },
        {
          title: 'Sports Day Coming Soon!',
          body: 'Annual Sports & Culture Day will be held on February 14th. Students should prepare for track events, drama, and music. More details will be shared soon.',
          audience: 'students',
          active: true
        }
      ]);
      console.log('✅ Test announcements created');
    }

    // Create test gallery images
    const existingGallery = await GalleryImage.countDocuments();
    if (existingGallery === 0) {
      // Get admin user for uploadedBy
      let admin = await User.findOne({ role: 'admin' });
      if (!admin) {
        admin = await User.create({
          name: 'System Admin',
          email: 'admin@test.com',
          passwordHash: 'password123',
          role: 'admin',
          mustChangePassword: false,
          isActive: true
        });
      }

      await GalleryImage.create([
        {
          title: 'Classroom Learning',
          description: 'Students engaged in interactive CBC lessons',
          imageUrl: 'IMG-20250625-WA0002.jpg',
          uploadedBy: admin._id,
          active: true
        },
        {
          title: 'School Compound',
          description: 'Beautiful and secure learning environment',
          imageUrl: 'IMG-20250625-WA0005.jpg',
          uploadedBy: admin._id,
          active: true
        },
        {
          title: 'Students at Play',
          description: 'Happy moments during break time',
          imageUrl: 'IMG-20250625-WA0010.jpg',
          uploadedBy: admin._id,
          active: true
        }
      ]);
      console.log('✅ Test gallery images created');
    }

    console.log('✅ Test data creation completed!');
    console.log(`Parent login: ${parentEmail} / password123`);
    console.log(`Student admission: ${admissionNumber} / password123`);

  } catch (err) {
    console.error('Error creating test data:', err);
  } finally {
    process.exit();
  }
}

createTestData();