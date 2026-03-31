const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User');
const Block = require('../models/Block');

dotenv.config();

const firstNames = [
    'Arjun', 'Rahul', 'Priya', 'Sneha', 'Karthik', 'Rohan', 'Ananya', 'Vikram', 'Neha', 'Aditya',
    'Kavya', 'Sanjay', 'Pooja', 'Deepak', 'Shreya', 'Manoj', 'Ishani', 'Nitin', 'Anjali', 'Harish',
    'Abhishek', 'Megha', 'Siddharth', 'Divya', 'Gaurav', 'Riya', 'Sameer', 'Priyanka', 'Varun', 'Aishwarya',
    'Kunal', 'Jyoti', 'Tarun', 'Amrita', 'Prateek', 'Komal', 'Vishal', 'Preeti', 'Yash', 'Sunita'
];
const lastNames = [
    'Kumar', 'Sharma', 'Reddy', 'Iyer', 'Nair', 'Gupta', 'Verma', 'Patil', 'Joshi', 'Singh',
    'Rao', 'Das', 'Mukherjee', 'Bose', 'Menon', 'Gounder', 'Pillai', 'Chawla', 'Malhotra', 'Saxena',
    'Bose', 'Chandra', 'Yadav', 'Kulkarni', 'Naidu', 'Sastry', 'Bhatt', 'Trivedi', 'Mehta', 'Dalal',
    'Deshmukh', 'Kashyap', 'Bansal', 'Agarwal', 'Tyagi', 'Dubey', 'Ghoshal', 'Bhowmick', 'Majumdar', 'Roy'
];

function generateName(index) {
    // Adding index ensures more variation though randomness is usually enough for 150
    const fn = firstNames[(Math.floor(Math.random() * firstNames.length) + index) % firstNames.length];
    const ln = lastNames[(Math.floor(Math.random() * lastNames.length) + index) % lastNames.length];
    return `${fn} ${ln}`;
}

async function seedStudents() {
    try {
        console.log("🔍 Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB Connected");

        const blockA = await Block.findOne({ name: 'Block A' });
        const blockB = await Block.findOne({ name: 'Block B' });

        if (!blockA || !blockB) {
            console.error("❌ Required blocks (Block A, Block B) not found in database.");
            console.log("Tip: Ensure you have run the block seeding or created them via dashboard.");
            process.exit(1);
        }

        console.log("⏳ Hashing student password...");
        const commonPassword = await bcrypt.hash('student@123', 10);

        let createdA = 0;
        let createdB = 0;

        // Block A Students (50)
        console.log("📦 Generating Block A students...");
        const studentAData = [];
        for (let i = 1; i <= 50; i++) {
            const email = `student_a${i}@college.com`;
            const existing = await User.findOne({ email });
            if (!existing) {
                studentAData.push({
                    name: generateName(i),
                    email,
                    password: commonPassword,
                    role: 'student',
                    block: blockA._id,
                    provider: 'local',
                    status: 'active'
                });
            }
        }
        if (studentAData.length > 0) {
            await User.insertMany(studentAData);
            createdA = studentAData.length;
            console.log(`✅ 50 Block A students created`);
        } else {
            console.log('⚠️  Block A students already exist');
        }

        // Block B Students (100)
        console.log("📦 Generating Block B students...");
        const studentBData = [];
        for (let i = 1; i <= 100; i++) {
            const email = `student_b${i}@college.com`;
            const existing = await User.findOne({ email });
            if (!existing) {
                studentBData.push({
                    name: generateName(i + 50),
                    email,
                    password: commonPassword,
                    role: 'student',
                    block: blockB._id,
                    provider: 'local',
                    status: 'active'
                });
            }
        }
        if (studentBData.length > 0) {
            await User.insertMany(studentBData);
            createdB = studentBData.length;
            console.log(`✅ 100 Block B students created`);
        } else {
            console.log('⚠️  Block B students already exist');
        }

        console.log(`\n🎉 SEEDING COMPLETE!`);
        console.log(`- Block A: ${createdA} new students`);
        console.log(`- Block B: ${createdB} new students`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Seeding error:", err);
        process.exit(1);
    }
}

seedStudents();
