
const mongoose = require('mongoose');
const Block = require('../models/Block');
const User = require('../models/User');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '../.env') });

const studentNames = [
  'Arjun Kumar', 'Rahul Sharma', 'Rohan Verma', 'Amit Singh', 'Vikram Patel',
  'Suresh Nair', 'Karthik Reddy', 'Aditya Mehta', 'Ravi Gupta', 'Manoj Das',
  'Vijay Iyer', 'Harish Chandra', 'Deepak Verma', 'Sanjay Singh', 'Rajesh Kumar',
  'Pankaj Sharma', 'Anil Gupta', 'Sunil Mehta', 'Mahesh Das', 'Karan Patel'
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Ensure Block A and Block B exist
    let blockA = await Block.findOne({ name: 'Block A' });
    if (!blockA) {
      blockA = await Block.create({
        name: 'Block A',
        type: 'Hostel',
        capacity: 100,
        status: 'Active',
        monthly_budget: 50000,
        description: 'Hostel Block A'
      });
      console.log('Created Block A');
    }

    let blockB = await Block.findOne({ name: 'Block B' });
    if (!blockB) {
      blockB = await Block.create({
        name: 'Block B',
        type: 'Hostel',
        capacity: 100,
        status: 'Active',
        monthly_budget: 50000,
        description: 'Hostel Block B'
      });
      console.log('Created Block B');
    }

    // 2. Generate 200 students
    console.log('Seeding 200 students...');
    const students = [];

    // 100 students for Block A
    for (let i = 1; i <= 100; i++) {
      const name = studentNames[i % studentNames.length];
      students.push({
        name,
        email: `student_a${i}@college.com`,
        password: 'student@123',
        role: 'student',
        block: blockA._id,
        room: `A-${100 + i}`,
        floor: Math.floor(i / 30) + 1,
        status: 'active'
      });
    }

    // 100 students for Block B
    for (let i = 1; i <= 100; i++) {
      const name = studentNames[i % studentNames.length];
      students.push({
        name,
        email: `student_b${i}@college.com`,
        password: 'student@123',
        role: 'student',
        block: blockB._id,
        room: `B-${100 + i}`,
        floor: Math.floor(i / 30) + 1,
        status: 'active'
      });
    }

    // Bulk create to be efficient
    // We'll use insertMany but carefully since it might trigger some hooks
    // Actually, User model has a pre-save hook for password hashing.
    // To ensure hashing, we might need to create them one by one or hash manually.
    // Let's check User model.

    for (const student of students) {
      const existing = await User.findOne({ email: student.email });
      const hashedPassword = await bcrypt.hash(student.password, 10);

      if (!existing) {
        student.password = hashedPassword;
        await User.create(student);
      } else {
        existing.room = student.room;
        existing.floor = student.floor;
        existing.block = student.block;
        existing.password = hashedPassword;
        await existing.save();
      }
    }

    console.log('Successfully seeded 200 students');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
