require('dotenv').config();
const { connectDB, disconnectDB } = require('../src/config/db');
const { users, students, bills, results, payments, announcements, galleryImages } = require('../src/data/repositories');

async function createTestData() {
  try {
    console.log('Creating test data...');
    await connectDB();

    // Create a test parent
    const parentEmail = 'parent@test.com';
    let parent = await users.findByEmail(parentEmail);

    if (!parent) {
      parent = await users.create({
        name: 'Test Parent',
        email: parentEmail,
        passwordHash: 'password123',
        role: 'parent',
        mustChangePassword: false,
        isActive: true,
        children: [],
      });
      console.log('✅ Test parent created');
    }

    // Create a test student
    const admissionNumber = 'ADM/2025/001';
    let student = await students.findByAdmissionNumber(admissionNumber);

    if (!student) {
      student = await students.create({
        name: 'Test Student',
        admissionNumber,
        classLevel: 'Grade 1',
        gender: 'Male',
        dob: new Date('2018-01-01'),
        parent: parent.id,
        active: true,
      });
      await users.addChild(parent.id, student.id);
      console.log('✅ Test student created');
    }

    // Create some bills for the student
    const existingBills = await bills.count({ studentId: student.id });
    if (existingBills === 0) {
      await bills.create({
        student: student.id,
        description: 'Term 1 2025 Tuition',
        amount: 15000,
        amountPaid: 0,
        balance: 15000,
        term: 'Term 1',
        status: 'pending',
      });
      await bills.create({
        student: student.id,
        description: 'Term 1 2025 Meals',
        amount: 2200,
        amountPaid: 0,
        balance: 2200,
        term: 'Term 1',
        status: 'pending',
      });
      console.log('✅ Test bills created');
    }

    // Create a payment for the student
    const existingPayments = await payments.count({ studentId: student.id });
    if (existingPayments === 0) {
      await payments.create({
        student: student.id,
        amount: 10000,
        phone: '254712345678',
        status: 'success',
      });
      console.log('✅ Test payment created');
    }

    // Create some results for the student
    const existingResults = await results.count({ studentId: student.id });
    if (existingResults === 0) {
      await results.upsert({
        student: student.id,
        term: 'Term 1',
        subjects: [
          { name: 'Mathematics', score: 85, maxScore: 100 },
          { name: 'English', score: 78, maxScore: 100 },
          { name: 'Science', score: 82, maxScore: 100 },
        ],
        total: 245,
        grade: 'B+',
      });
      console.log('✅ Test results created');
    }

    // Create test announcements
    const existingAnnouncements = (await announcements.listActive({ limit: 1, offset: 0 })).total;
    if (existingAnnouncements === 0) {
      await announcements.create({
        title: 'School Reopening – Term 1 2026',
        body: 'School reopens on January 8th, 2026. All students are expected to report on time. Ensure school fees are cleared before resumption.',
        audience: 'public',
        active: true,
      });
      await announcements.create({
        title: 'Parents Meeting',
        body: 'A general parents meeting is scheduled for Friday, January 17th at 2:00 PM in the school hall. Attendance is highly encouraged to discuss your child\'s progress and school updates.',
        audience: 'parents',
        active: true,
      });
      await announcements.create({
        title: 'Sports Day Coming Soon!',
        body: 'Annual Sports & Culture Day will be held on February 14th. Students should prepare for track events, drama, and music. More details will be shared soon.',
        audience: 'students',
        active: true,
      });
      console.log('✅ Test announcements created');
    }

    // Create test gallery images
    const existingGallery = (await galleryImages.listActive()).length;
    if (existingGallery === 0) {
      // Get admin user for uploadedBy
      let admin = await users.findByEmail('admin@test.com');
      if (!admin) {
        admin = await users.create({
          name: 'System Admin',
          email: 'admin@test.com',
          passwordHash: 'password123',
          role: 'admin',
          mustChangePassword: false,
          isActive: true,
        });
      }

      await galleryImages.create({
        title: 'Classroom Learning',
        description: 'Students engaged in interactive CBC lessons',
        imageUrl: 'IMG-20250625-WA0002.jpg',
        uploadedBy: admin.id,
        active: true,
      });
      await galleryImages.create({
        title: 'School Compound',
        description: 'Beautiful and secure learning environment',
        imageUrl: 'IMG-20250625-WA0005.jpg',
        uploadedBy: admin.id,
        active: true,
      });
      await galleryImages.create({
        title: 'Students at Play',
        description: 'Happy moments during break time',
        imageUrl: 'IMG-20250625-WA0010.jpg',
        uploadedBy: admin.id,
        active: true,
      });
      console.log('✅ Test gallery images created');
    }

    console.log('✅ Test data creation completed!');
    console.log(`Parent login: ${parentEmail} / password123`);
    console.log(`Student admission: ${admissionNumber} / password123`);

  } catch (err) {
    console.error('Error creating test data:', err);
  } finally {
    await disconnectDB();
    process.exit();
  }
}

createTestData();
