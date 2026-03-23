const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Block = require('./models/Block');
const SystemConfig = require('./models/SystemConfig');
const { ROLES } = require('./config/roles');
const bcrypt = require('bcryptjs');

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected for Seeding');
    } catch (err) {
        console.error('Database Connection Failed:', err.message);
        process.exit(1);
    }
};

const seedData = async () => {
    await connectDB();

    // 1. Seed Blocks first (so wardens can be assigned to them)
    const blockDefs = [
        { name: 'Hostel Block A', description: 'Main hostel block for first-year students' },
        { name: 'Hostel Block B', description: 'Hostel block for second-year students' },
        { name: 'Hostel Block C', description: 'Hostel block for senior students' },
    ];

    const blockMap = {}; // name -> Block document
    for (const def of blockDefs) {
        let block = await Block.findOneAndUpdate(
            { name: def.name },
            { name: def.name, description: def.description },
            { upsert: true, new: true }
        );
        blockMap[def.name] = block;
        console.log(`✅ Block Seeded/Updated: ${def.name} (${block._id})`);
    }

    // 2. Seed Users — including General Manager and wardens with block assignments
    const users = [
        {
            name: 'System Administrator',
            email: 'admin@college.com',
            password: 'Admin@123',
            role: ROLES.ADMIN,
            block: null // Admin sees all blocks
        },
        {
            name: 'General Manager',
            email: 'gm@college.com',
            password: 'GM@123456',
            role: ROLES.GM,
            block: null // GM monitors all blocks
        },
        {
            name: 'Warden Block A',
            email: 'warden.a@college.com',
            password: 'Warden@123',
            role: ROLES.WARDEN,
            block: blockMap['Hostel Block A']?._id || null
        },
        {
            name: 'Warden Block B',
            email: 'warden.b@college.com',
            password: 'Warden@123',
            role: ROLES.WARDEN,
            block: blockMap['Hostel Block B']?._id || null
        },
        // Legacy warden account (kept for backward compatibility, assigned to Block A)
        {
            name: 'Hostel Warden',
            email: 'warden@college.com',
            password: 'Warden@123',
            role: ROLES.WARDEN,
            block: blockMap['Hostel Block A']?._id || null
        },
        {
            name: 'Student User',
            email: 'student@college.com',
            password: 'Student@123',
            role: ROLES.STUDENT,
            block: blockMap['Hostel Block A']?._id || null
        },
        {
            name: 'College Dean',
            email: 'dean@college.com',
            password: 'Dean@123',
            role: ROLES.DEAN,
            block: null
        },
        {
            name: 'College Principal',
            email: 'principal@college.com',
            password: 'Principal@123',
            role: ROLES.DEAN,
            block: null
        }
    ];

    for (const user of users) {
        const hashedPassword = await bcrypt.hash(user.password, 10);

        const updateData = {
            name: user.name,
            email: user.email,
            password: hashedPassword,
            role: user.role,
            provider: 'local',
            status: 'active'
        };

        // Only set block if it's defined (don't overwrite existing block assignments with null)
        if (user.block) {
            updateData.block = user.block;
        }

        await User.findOneAndUpdate(
            { email: user.email },
            updateData,
            { upsert: true, returnDocument: 'after' }
        );
        const blockLabel = user.block
            ? ` → Block: ${Object.keys(blockMap).find(k => blockMap[k]._id.toString() === user.block?.toString()) || user.block}`
            : '';
        console.log(`✅ User Seeded/Updated: ${user.email} (${user.role})${blockLabel}`);
    }

    // 3. Seed System Configurations (Thresholds)
    const defaults = [
        {
            resource: 'Electricity',
            unit: 'kWh',
            rate: 12,
            dailyLimitPerPerson: 5,
            dailyLimitPerBlock: 500,
            monthlyLimitPerPerson: 150,
            severityThreshold: { medium: 70, high: 90, critical: 100 }
        },
        {
            resource: 'Water',
            unit: 'Liters',
            rate: 0.15,
            dailyLimitPerPerson: 100,
            dailyLimitPerBlock: 10000,
            monthlyLimitPerPerson: 3000,
            severityThreshold: { medium: 80, high: 90, critical: 100 }
        },
        {
            resource: 'Solar',
            unit: 'kg',
            rate: 150,
            dailyLimitPerPerson: 1.5,
            dailyLimitPerBlock: 150,
            monthlyLimitPerPerson: 45,
            severityThreshold: { medium: 60, high: 80, critical: 95 }
        },
        {
            resource: 'LPG',
            unit: 'kg',
            rate: 90,
            dailyLimitPerPerson: 0.1,
            dailyLimitPerBlock: 10,
            monthlyLimitPerPerson: 3,
            severityThreshold: { medium: 60, high: 85, critical: 95 }
        },
        {
            resource: 'Diesel',
            unit: 'Liters',
            rate: 95,
            dailyLimitPerPerson: 0.05,
            dailyLimitPerBlock: 5,
            monthlyLimitPerPerson: 1.5,
            severityThreshold: { medium: 50, high: 75, critical: 90 }
        },
        {
            resource: 'Waste',
            unit: 'kg',
            rate: 0,
            dailyLimitPerPerson: 0.5,
            dailyLimitPerBlock: 50,
            monthlyLimitPerPerson: 15,
            severityThreshold: { medium: 70, high: 90, critical: 100 }
        }
    ];

    for (const config of defaults) {
        const exists = await SystemConfig.findOne({ resource: config.resource });
        if (!exists) {
            await SystemConfig.create(config);
            console.log(`✅ Config Created: ${config.resource}`);
        }
    }
    console.log('ℹ️ System Configuration Seeded');

    console.log('\n📋 TEST CREDENTIALS SUMMARY');
    console.log('═══════════════════════════════════════════════');
    console.log('Role              Email                    Password');
    console.log('───────────────────────────────────────────────');
    console.log('Admin             admin@college.com        Admin@123');
    console.log('General Manager   gm@college.com           GM@123456');
    console.log('Warden (Block A)  warden.a@college.com     Warden@123');
    console.log('Warden (Block B)  warden.b@college.com     Warden@123');
    console.log('Warden (legacy)   warden@college.com       Warden@123');
    console.log('Student           student@college.com      Student@123');
    console.log('Dean              dean@college.com         Dean@123');
    console.log('Principal         principal@college.com    Principal@123');
    console.log('═══════════════════════════════════════════════\n');

    process.exit();
};

seedData();
