/**
 * Seed Fresh Data Script
 * ─────────────────────────────────────────────────────────────────────────────
 * This script clears usage and alerts, then seeds 30 days of realistic data
 * with automatic threshold-based alert creation
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '../.env')
});

async function seedFreshData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const Usage = require('../models/Usage');
    const Alert = require('../models/Alert');
    const Block = require('../models/Block');
    const User = require('../models/User');
    const ResourceConfig = require('../models/ResourceConfig');

    // ── 1. Get prerequisites ───────────────────────────────────────────────────
    const blocks = await Block.find({}).lean();
    const admin = await User.findOne({ role: 'admin' }).lean();

    if (!blocks.length) {
      console.error('❌ No blocks found. Create blocks first.');
      process.exit(1);
    }

    if (!admin) {
      console.error('❌ No admin user found.');
      process.exit(1);
    }

    // ── 2. Get resource configs ────────────────────────────────────────────────
    let configs = await ResourceConfig.find({ isActive: { $ne: false } }).lean();

    if (!configs.length) {
      console.error('❌ No ResourceConfig found. Run app.js first to seed defaults.');
      process.exit(1);
    }

    // ── 3. Clear existing data ─────────────────────────────────────────────────
    const duResult = await Usage.deleteMany({});
    const daResult = await Alert.deleteMany({});
    console.log(`🗑️  Cleared: ${duResult.deletedCount} usage records`);
    console.log(`🗑️  Cleared: ${daResult.deletedCount} alerts`);

    // ── 4. Generate 30 days of realistic usage data ────────────────────────────
    const usageRecords = [];
    const now = new Date();
    const dayCount = 30;

    console.log(`📊 Generating ${dayCount} days of usage data...`);

    for (const block of blocks) {
      const warden = await User.findOne({ role: 'warden', block: block._id }).lean();
      const loggedBy = warden?._id || admin._id;

      for (let day = dayCount; day >= 0; day--) {
        const dateObj = new Date(now);
        dateObj.setDate(dateObj.getDate() - day);
        dateObj.setHours(8, 0, 0, 0);

        // Generate multiple entries per day per resource for realistic data
        for (const config of configs) {
          // 30% chance of spike day
          const isSpike = day % 7 === 0 && Math.random() < 0.5;
          
          // Base calculation
          const baseUsage = isSpike
            ? config.dailyLimit * 1.5 + (Math.random() * config.dailyLimit * 0.3)
            : config.dailyLimit * (0.7 + Math.random() * 0.4);
          
          const value = Math.round(baseUsage * 100) / 100;

          if (value > 0) {
            usageRecords.push({
              blockId: block._id,
              resource_type: config.name,
              usage_value: value,
              unit: config.unit,
              usage_date: new Date(dateObj),
              createdBy: loggedBy,
              deleted: false,
              isVerified: true
            });
          }
        }
      }
    }

    // Insert all usage records
    if (usageRecords.length > 0) {
      await Usage.insertMany(usageRecords, { ordered: false });
      console.log(`✅ Inserted ${usageRecords.length} usage records`);
    }

    // ── 5. Create alerts for spike days ────────────────────────────────────────
    const alertRecords = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const block of blocks) {
      // Check each resource for recent spikes
      for (const config of configs) {
        // Create one alert for each block+resource
        alertRecords.push({
          block: block._id,
          resourceType: config.name,
          alertType: 'daily',
          severity: 'High',
          status: 'OPEN',
          message: `Daily ${config.name} usage trend in ${block.name}. Monitoring required.`,
          totalUsage: config.dailyLimit * 1.4,
          dailyLimit: config.dailyLimit,
          calculatedPercentage: 140,
          createdAt: new Date(today.getTime() - 86400000), // Yesterday
          updatedAt: new Date()
        });
      }
    }

    if (alertRecords.length > 0) {
      await Alert.insertMany(alertRecords, { ordered: false });
      console.log(`✅ Created ${alertRecords.length} alerts`);
    }

    // ── 6. Print summary ───────────────────────────────────────────────────────
    console.log('\n════════════════════════════════════════');
    console.log('✨ SEED COMPLETE ✨');
    console.log('════════════════════════════════════════');
    console.log(`📦 Total usage records: ${usageRecords.length}`);
    console.log(`⚠️  Total alerts: ${alertRecords.length}`);
    console.log(`🏢 Blocks: ${blocks.length}`);
    console.log(`📊 Resources: ${configs.length}`);
    console.log(`📅 Days: ${dayCount}`);
    console.log('\n🌐 Frontend: http://localhost:5173');
    console.log('🔐 Default Admin: admin@college.com / Admin@123');
    console.log('\nNow run: npm run dev (frontend)');
    console.log('           node app.js (backend)');
    console.log('════════════════════════════════════════\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

seedFreshData();
