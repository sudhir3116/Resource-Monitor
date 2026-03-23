/**
 * scripts/seedUsers.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Full production seed:
 *   • 10 Hostel Blocks (A–J)
 *   • 1 Admin
 *   • 10 Wardens (one per block)
 *   • 30 Students (3 per block)
 *   • 6 System resource configs
 *
 * Run:  node scripts/seedUsers.js
 * Safe: uses upsert — re-running will not create duplicates.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
dotenv.config({ path: require('path').join(__dirname, '../.env') });

const User = require('../models/User');
const Block = require('../models/Block');
const SystemConfig = require('../models/SystemConfig');
const { ROLES } = require('../config/roles');

const BLOCKS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const HASH_ROUNDS = 10;

async function hash(plain) {
    return bcrypt.hash(plain, HASH_ROUNDS);
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅  MongoDB connected\n');

    // ── 1. Upsert Blocks ────────────────────────────────────────────────────
    console.log('📦  Seeding blocks...');
    const blockDocs = {};
    for (const letter of BLOCKS) {
        const doc = await Block.findOneAndUpdate(
            { name: `Block ${letter}` },
            {
                name: `Block ${letter}`,
                type: 'Hostel',
                capacity: 60,
                status: 'Active',
                monthly_budget: 50000,
            },
            { upsert: true, new: true }
        );
        blockDocs[letter] = doc;
        console.log(`   ✓ Block ${letter}  (${doc._id})`);
    }

    // ── 2. Admin ─────────────────────────────────────────────────────────────
    console.log('\n👨‍💼  Seeding admin...');
    await User.findOneAndUpdate(
        { email: 'admin@college.com' },
        {
            name: 'System Administrator',
            email: 'admin@college.com',
            password: await hash('Admin@123'),
            role: ROLES.ADMIN,
            status: 'active',
            provider: 'local',
        },
        { upsert: true, new: true }
    );
    console.log('   ✓ admin@college.com  (Admin@123)');

    // ── 2a. GM ───────────────────────────────────────────────────────────────
    console.log('\n🧑‍💼  Seeding GM...');
    await User.findOneAndUpdate(
        { email: 'gm@college.com' },
        {
            name: 'General Manager',
            email: 'gm@college.com',
            password: await hash('GM@123'),
            role: ROLES.GM,
            status: 'active',
            provider: 'local',
        },
        { upsert: true, new: true }
    );
    console.log('   ✓ gm@college.com  (GM@123)');

    // ── 2b. Dean ─────────────────────────────────────────────────────────────
    console.log('\n🎓  Seeding Dean...');
    await User.findOneAndUpdate(
        { email: 'dean@college.com' },
        {
            name: 'College Dean',
            email: 'dean@college.com',
            password: await hash('Dean@123'),
            role: ROLES.DEAN,
            status: 'active',
            provider: 'local',
        },
        { upsert: true, new: true }
    );
    console.log('   ✓ dean@college.com  (Dean@123)');

    // ── 3. Wardens (one per block) ────────────────────────────────────────
    console.log('\n🏠  Seeding wardens...');
    for (const letter of BLOCKS) {
        const email = `warden.block${letter.toLowerCase()}@college.com`;
        const blockDoc = blockDocs[letter];

        const warden = await User.findOneAndUpdate(
            { email },
            {
                name: `Warden Block ${letter}`,
                email,
                password: await hash('Warden@123'),
                role: ROLES.WARDEN,
                block: blockDoc._id,
                status: 'active',
                provider: 'local',
            },
            { upsert: true, new: true }
        );

        // Keep Block.warden in sync
        await Block.findByIdAndUpdate(blockDoc._id, { warden: warden._id });
        console.log(`   ✓ ${email}  (Warden@123)  → Block ${letter}`);
    }

    // ── 4. Students (3 per block = 30 total) ─────────────────────────────
    console.log('\n🎓  Seeding students...');
    const rooms = ['101', '102', '103'];
    let studentIdx = 1;

    for (const letter of BLOCKS) {
        const blockDoc = blockDocs[letter];
        for (let r = 0; r < 3; r++) {
            const padded = String(studentIdx).padStart(3, '0');
            const email = `student${padded}@college.com`;
            await User.findOneAndUpdate(
                { email },
                {
                    name: `Student ${studentIdx} (Block ${letter})`,
                    email,
                    password: await hash('Student@123'),
                    role: ROLES.STUDENT,
                    block: blockDoc._id,
                    room: `${letter}-${rooms[r]}`,
                    status: 'active',
                    provider: 'local',
                },
                { upsert: true, new: true }
            );
            console.log(`   ✓ ${email}  (Student@123)  → Block ${letter} / Room ${letter}-${rooms[r]}`);
            studentIdx++;
        }
    }

    // ── 5. System resource configs (skip if exists) ───────────────────────
    console.log('\n⚙️   Seeding system configs...');
    const configs = [
        { resource: 'Electricity', unit: 'kWh', costPerUnit: 12, dailyThreshold: 500, monthlyThreshold: 15000, dailyLimitPerPerson: 5, monthlyLimitPerPerson: 150, monthlyLimitPerBlock: 15000, alertsEnabled: true },
        { resource: 'Water', unit: 'Litres', costPerUnit: 0.5, dailyThreshold: 10000, monthlyThreshold: 300000, dailyLimitPerPerson: 100, monthlyLimitPerPerson: 3000, monthlyLimitPerBlock: 300000, alertsEnabled: true },
        { resource: 'LPG', unit: 'kg', costPerUnit: 80, dailyThreshold: 10, monthlyThreshold: 300, dailyLimitPerPerson: 0.1, monthlyLimitPerPerson: 3, monthlyLimitPerBlock: 300, alertsEnabled: true },
        { resource: 'Diesel', unit: 'Litres', costPerUnit: 95, dailyThreshold: 5, monthlyThreshold: 150, dailyLimitPerPerson: 0.05, monthlyLimitPerPerson: 1.5, monthlyLimitPerBlock: 150, alertsEnabled: true },
        { resource: 'Solar', unit: 'kWh', costPerUnit: 150, dailyThreshold: 150, monthlyThreshold: 4500, dailyLimitPerPerson: 1.5, monthlyLimitPerPerson: 45, monthlyLimitPerBlock: 4500, alertsEnabled: false },
        { resource: 'Waste', unit: 'kg', costPerUnit: 0, dailyThreshold: 50, monthlyThreshold: 1500, dailyLimitPerPerson: 0.5, monthlyLimitPerPerson: 15, monthlyLimitPerBlock: 1500, alertsEnabled: false },
    ];

    for (const cfg of configs) {
        const exists = await SystemConfig.findOne({ resource: cfg.resource });
        if (!exists) {
            await SystemConfig.create(cfg);
            console.log(`   ✓ Created config: ${cfg.resource}`);
        } else {
            console.log(`   – Config already exists: ${cfg.resource} (skipped)`);
        }
    }

    console.log('\n🎉  Seed complete!\n');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('TEST CREDENTIALS');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('Admin      →  admin@college.com            /  Admin@123');
    console.log('GM         →  gm@college.com               /  GM@123');
    console.log('Dean       →  dean@college.com             /  Dean@123');
    console.log('Warden A   →  warden.blocka@college.com    /  Warden@123');
    console.log('Warden B   →  warden.blockb@college.com    /  Warden@123');
    console.log('...        →  warden.block[a-j]@college.com  /  Warden@123');
    console.log('Student 1  →  student001@college.com       /  Student@123');
    console.log('...        →  student001–030@college.com   /  Student@123');
    console.log('─────────────────────────────────────────────────────────────\n');

    await mongoose.disconnect();
}

main().catch(err => {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
});
