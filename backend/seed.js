const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
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

    // 1. Seed Admin User
    const adminEmail = 'admin@college.com';
    const adminExists = await User.findOne({ email: adminEmail });

    if (!adminExists) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await User.create({
            name: 'System Administrator',
            email: adminEmail,
            password: hashedPassword,
            role: ROLES.ADMIN,
            provider: 'local'
        });
        console.log('✅ Admin User Created (admin@college.com / admin123)');
    } else {
        console.log('ℹ️ Admin User already exists');
    }

    // 2. Seed System Configurations (Thresholds)
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
            rate: 0.15, // Cost per liter (approx)
            dailyLimitPerPerson: 100, // liters/day
            dailyLimitPerBlock: 10000,
            monthlyLimitPerPerson: 3000,
            severityThreshold: { medium: 80, high: 90, critical: 100 }
        },
        {
            resource: 'Food',
            unit: 'kg',
            rate: 150, // Cost per kg (average meal cost?)
            dailyLimitPerPerson: 1.5, // kg/day
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

    process.exit();
};

seedData();
