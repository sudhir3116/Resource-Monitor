const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Block = require('./models/Block');
const Usage = require('./models/Usage');
const { ROLES } = require('./config/roles');
const bcrypt = require('bcryptjs');

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected for Test Data Seeding');
    } catch (err) {
        console.error('Database Connection Failed:', err.message);
        process.exit(1);
    }
};

const seedTestData = async () => {
    await connectDB();

    try {
        // 1. Create Hostel Blocks
        const blocks = [
            { name: 'Hostel Block A', capacity: 100 },
            { name: 'Hostel Block B', capacity: 150 },
            { name: 'Hostel Block C', capacity: 120 }
        ];

        const createdBlocks = [];
        for (const blockData of blocks) {
            const existing = await Block.findOne({ name: blockData.name });
            if (!existing) {
                const block = await Block.create(blockData);
                createdBlocks.push(block);
                console.log(`✅ Created block: ${block.name}`);
            } else {
                createdBlocks.push(existing);
                console.log(`ℹ️  Block already exists: ${existing.name}`);
            }
        }

        // 2. Create Test Users for Each Role
        const testUsers = [
            {
                name: 'John Student',
                email: 'student@college.com',
                password: 'student123',
                role: ROLES.STUDENT,
                block: createdBlocks[0]._id,
                room: '101',
                floor: 1
            },
            {
                name: 'Jane Warden',
                email: 'warden@college.com',
                password: 'warden123',
                role: ROLES.WARDEN,
                block: createdBlocks[0]._id
            },
            {
                name: 'Dr. Dean',
                email: 'dean@college.com',
                password: 'dean123',
                role: ROLES.DEAN
            },
            {
                name: 'Dr. Principal',
                email: 'principal@college.com',
                password: 'principal123',
                role: ROLES.PRINCIPAL
            },
            // Additional students for testing
            {
                name: 'Alice Student',
                email: 'alice@college.com',
                password: 'student123',
                role: ROLES.STUDENT,
                block: createdBlocks[0]._id,
                room: '102',
                floor: 1
            },
            {
                name: 'Bob Student',
                email: 'bob@college.com',
                password: 'student123',
                role: ROLES.STUDENT,
                block: createdBlocks[1]._id,
                room: '201',
                floor: 2
            }
        ];

        const createdUsers = [];
        for (const userData of testUsers) {
            const existing = await User.findOne({ email: userData.email });
            if (!existing) {
                const hashedPassword = await bcrypt.hash(userData.password, 10);
                const user = await User.create({
                    ...userData,
                    password: hashedPassword,
                    provider: 'local'
                });
                createdUsers.push(user);
                console.log(`✅ Created user: ${user.name} (${user.role}) - ${user.email}`);
            } else {
                createdUsers.push(existing);
                console.log(`ℹ️  User already exists: ${existing.email}`);
            }
        }

        // 3. Create Sample Usage Data for Students
        const today = new Date();
        const usageData = [];

        // Generate usage for last 7 days
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);

            // Find students
            const students = createdUsers.filter(u => u.role === ROLES.STUDENT);

            for (const student of students) {
                // Each student gets random usage records
                const resources = ['Electricity', 'Water', 'Food'];
                for (const resource of resources) {
                    const amount = Math.random() * (resource === 'Electricity' ? 10 : resource === 'Water' ? 150 : 2);

                    usageData.push({
                        userId: student._id,
                        blockId: student.block,
                        resource_type: resource,
                        category: 'General',
                        usage_value: parseFloat(amount.toFixed(2)),
                        unit: resource === 'Electricity' ? 'kWh' : resource === 'Water' ? 'Liters' : 'kg',
                        usage_date: date,
                        notes: `Day ${i + 1} usage`
                    });
                }
            }
        }

        // Add block-level usage (as if warden added)
        const blockResources = [
            { resource: 'Electricity', amount: 500, unit: 'kWh' },
            { resource: 'Water', amount: 10000, unit: 'Liters' },
            { resource: 'LPG', amount: 15, unit: 'kg' },
            { resource: 'Diesel', amount: 8, unit: 'Liters' }
        ];

        for (const block of createdBlocks) {
            for (const res of blockResources) {
                usageData.push({
                    blockId: block._id,
                    resource_type: res.resource,
                    category: block.name,
                    usage_value: res.amount,
                    unit: res.unit,
                    usage_date: today,
                    notes: 'Monthly block consumption'
                });
            }
        }

        // Insert usage data (avoid duplicates)
        let insertedCount = 0;
        for (const usage of usageData) {
            const existing = await Usage.findOne({
                userId: usage.userId || null,
                blockId: usage.blockId,
                resource_type: usage.resource_type,
                usage_date: usage.usage_date
            });

            if (!existing) {
                await Usage.create(usage);
                insertedCount++;
            }
        }

        console.log(`✅ Created ${insertedCount} usage records`);

        console.log('\n===========================================');
        console.log('✅ TEST DATA SEEDING COMPLETE!');
        console.log('===========================================\n');

        console.log('📋 Login Credentials:');
        console.log('─────────────────────────────────────────');
        console.log('Admin:     admin@college.com     / admin123');
        console.log('Student:   student@college.com   / student123');
        console.log('Warden:    warden@college.com    / warden123');
        console.log('Dean:      dean@college.com      / dean123');
        console.log('Principal: principal@college.com / principal123');
        console.log('─────────────────────────────────────────\n');

        console.log('🎯 Next Steps:');
        console.log('1. Access http://localhost:5173');
        console.log('2. Login with any credential above');
        console.log('3. See different dashboards based on role!\n');

    } catch (error) {
        console.error('Error seeding test data:', error);
    }

    process.exit();
};

seedTestData();
