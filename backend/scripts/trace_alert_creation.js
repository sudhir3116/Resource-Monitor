#!/usr/bin/env node

/**
 * ALERT CREATION TRACE SCRIPT
 * 
 * This script will:
 * 1. Create a test usage record that exceeds daily threshold
 * 2. Capture all console logs from the trace
 * 3. Report the exact point where alert creation succeeds or fails
 * 
 * Run: node scripts/trace_alert_creation.js
 */

require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

const User = require('../models/User');
const Block = require('../models/Block');
const Usage = require('../models/Usage');
const Alert = require('../models/Alert');
const SystemConfig = require('../models/SystemConfig');

let logs = [];
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
    logs.push(args.join(' '));
    originalLog.apply(console, args);
};

console.error = function(...args) {
    logs.push('[ERROR] ' + args.join(' '));
    originalError.apply(console, args);
};

async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sustainable_monitor');
        originalLog('\n✓ Connected to MongoDB\n');
    } catch (err) {
        originalError('✗ Connection failed:', err.message);
        process.exit(1);
    }
}

async function setup() {
    originalLog('═══════════════════════════════════════════════════════');
    originalLog('SETTING UP TEST DATA');
    originalLog('═══════════════════════════════════════════════════════\n');

    // Create test block
    let block = await Block.findOne({ name: 'TRACE_TEST_BLOCK' });
    if (!block) {
        block = await Block.create({
            name: 'TRACE_TEST_BLOCK',
            head_name: 'Test Head',
            head_contact: '9999999999',
            monthly_budget: 50000
        });
        originalLog(`✓ Test block created: ${block._id}`);
    }

    // Create test warden
    let warden = await User.findOne({ email: 'tracewarden@test.com' });
    if (!warden) {
        warden = await User.create({
            name: 'Trace Warden',
            email: 'tracewarden@test.com',
            password: 'hashed',
            role: 'warden',
            block: block._id
        });
        originalLog(`✓ Test warden created: ${warden._id}`);
    }

    // Ensure Electricity config exists
    let config = await SystemConfig.findOne({ resource: 'Electricity' });
    if (!config) {
        config = await SystemConfig.create({
            resource: 'Electricity',
            unit: 'kWh',
            isActive: true,
            alertsEnabled: true,
            dailyThreshold: 50,
            dailyLimitPerPerson: 50,
            monthlyThreshold: 1000,
            monthlyLimitPerPerson: 1000,
            costPerUnit: 12,
            rate: 12,
            blockOverrides: new Map()
        });
        originalLog(`✓ Electricity config created`);
    }

    originalLog(`\nConfig details:`);
    originalLog(`  ├─ isActive: ${config.isActive}`);
    originalLog(`  ├─ alertsEnabled: ${config.alertsEnabled}`);
    originalLog(`  ├─ dailyThreshold: ${config.dailyThreshold}`);
    originalLog(`  └─ monthlyThreshold: ${config.monthlyThreshold}\n`);

    // Clean up old records
    await Alert.deleteMany({ resourceType: 'Electricity', block: block._id });
    const oldUsages = await Usage.deleteMany({ 
        blockId: block._id,
        userId: warden._id
    });
    originalLog(`✓ Cleaned up: ${oldUsages.deletedCount} old usage records\n`);

    return { block, warden, config };
}

async function runTest() {
    const { block, warden, config } = await setup();

    originalLog('═══════════════════════════════════════════════════════');
    originalLog('CREATING TEST USAGE (120 kWh > 50 kWh limit)');
    originalLog('═══════════════════════════════════════════════════════\n');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Import checkThresholds here to get fresh code with logging
    const { checkThresholds } = require('../services/thresholdService');

    // Log clear separator
    originalLog('\n' + '═'.repeat(70));
    originalLog('TRACE LOG OUTPUT (capturing all console.log calls)');
    originalLog('═'.repeat(70) + '\n');

    // Create usage that exceeds threshold
    const usage = await Usage.create({
        userId: warden._id,
        blockId: block._id,
        resource_type: 'Electricity',
        usage_value: 120,
        unit: 'kWh',
        usage_date: today,
        category: 'General',
        createdBy: warden._id
    });

    originalLog(`\n[MAIN] Usage record created: ${usage._id}\n`);

    // This should trigger threshold check
    await checkThresholds(warden._id, 'Electricity', today, block._id);

    originalLog('\n' + '═'.repeat(70));
    originalLog('CHECKING ALERT CREATION RESULT');
    originalLog('═'.repeat(70) + '\n');

    // Verify alert was created
    const alert = await Alert.findOne({
        block: block._id,
        resourceType: 'Electricity',
        alertType: 'daily'
    });

    if (alert) {
        originalLog(`✅ ALERT CREATED SUCCESSFULLY`);
        originalLog(`  ├─ alertId: ${alert._id}`);
        originalLog(`  ├─ status: ${alert.status}`);
        originalLog(`  ├─ severity: ${alert.severity}`);
        originalLog(`  ├─ severityLevel: ${alert.severityLevel}`);
        originalLog(`  └─ message: ${alert.message}`);
    } else {
        originalLog(`❌ ALERT NOT CREATED - This is the problem!`);
        originalLog(`\nSearching Alert collection for any matching docs...`);
        const allAlerts = await Alert.find({ 
            block: block._id,
            resourceType: 'Electricity'
        });
        originalLog(`  Found ${allAlerts.length} total alerts for this block/resource`);
    }

    originalLog('\n' + '═'.repeat(70));
    originalLog('FULL TRACE LOG');
    originalLog('═'.repeat(70) + '\n');
    
    logs.forEach(log => originalLog(log));

    originalLog('\n' + '═'.repeat(70));
    originalLog('ANALYSIS');
    originalLog('═'.repeat(70) + '\n');

    const traceLines = logs.filter(l => l.includes('[TRACE'));
    originalLog(`Total trace messages: ${traceLines.length}`);
    originalLog('\nTrace milestone order:');
    traceLines.forEach((line, i) => {
        const match = line.match(/\[TRACE:([A-Z_]+)\]/);
        if (match) {
            originalLog(`  ${i + 1}. ${match[1]}`);
        }
    });

    // Analyze where it stopped
    const lastTrace = logs.reverse().find(l => l.includes('[TRACE'));
    originalLog(`\nLast trace message: ${lastTrace.split('[TRACE')[1].split(']')[0]}`);

    originalLog('\n');
    await mongoose.disconnect();
}

async function main() {
    try {
        await connectDB();
        await runTest();
    } catch (err) {
        originalError('FATAL ERROR:', err);
        process.exit(1);
    }
}

main();
