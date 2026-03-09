#!/usr/bin/env node

require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

const User = require('../models/User');
const Block = require('../models/Block');
const Usage = require('../models/Usage');
const Alert = require('../models/Alert');
const SystemConfig = require('../models/SystemConfig');

async function main() {
    try {
        console.log('\n[SETUP] Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('[SETUP] ✓ Connected\n');

        // Get or create test data
        console.log('[SETUP] Preparing test data...');
        
        let block = await Block.findOne({ name: 'TRACE_TEST_BLOCK' });
        if (!block) {
            block = await Block.create({
                name: 'TRACE_TEST_BLOCK',
                head_name: 'Test', 
                head_contact: '9999999999'
            });
        }
        console.log(`[SETUP] Block: ${block._id}`);

        let warden = await User.findOne({ email: 'trace@test.com' });
        if (!warden) {
            warden = await User.create({
                name: 'Trace',
                email: 'trace@test.com',
                password: 'hash',
                role: 'warden',
                block: block._id
            });
        }
        console.log(`[SETUP] Warden: ${warden._id}`);

        // Ensure config
        let config = await SystemConfig.findOne({ resource: 'Electricity' });
        if (!config) {
            config = await SystemConfig.create({
                resource: 'Electricity',
                unit: 'kWh',
                isActive: true,
                alertsEnabled: true,
                dailyThreshold: 50,
                monthlyThreshold: 1000,
                costPerUnit: 12
            });
        }
        console.log(`[SETUP] Config - dailyThreshold: ${config.dailyThreshold}, alertsEnabled: ${config.alertsEnabled}\n`);

        // Clean up alerts for this test
        await Alert.deleteMany({ block: block._id, resourceType: 'Electricity' });
        console.log('[SETUP] Cleaned old alerts\n');

        // Create high-usage entry
        console.log('═══════════════════════════════════════════════════\n');
        console.log('[TEST] Creating usage: 120 kWh (exceeds 50 kWh limit)\n');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

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
        console.log(`[RESULT] Usage created: ${usage._id}`);
        console.log(`         Value: ${usage.usage_value} kWh\n`);

        // Check if checkThresholds was called (in the controller it would be)
        console.log('[TEST] Running checkThresholds...\n');
        const { checkThresholds } = require('../services/thresholdService');
        await checkThresholds(warden._id, 'Electricity', today, block._id);

        // Wait a moment for DB writes
        await new Promise(r => setTimeout(r, 1000));

        // Check results
        console.log('\n═══════════════════════════════════════════════════\n');
        const alert = await Alert.findOne({
            block: block._id,
            resourceType: 'Electricity',
            alertType: 'daily'
        });

        if (alert) {
            console.log('✅ ALERT CREATED!\n');
            console.log(`   ID: ${alert._id}`);
            console.log(`   Status: ${alert.status}`);
            console.log(`   Severity: ${alert.severity}`);
            console.log(`   Message: ${alert.message}\n`);
        } else {
            console.log('❌ ALERT NOT CREATED\n');
            console.log('Checking Alert collection for any documents with this block...');
            const allAlerts = await Alert.find({ block: block._id });
            console.log(`   Found: ${allAlerts.length} alerts\n`);

            // Check if the alerts collection exists
            try {
                const collections = await mongoose.connection.db.listCollections().toArray();
                const hasAlerts = collections.some(c => c.name === 'alerts');
                console.log(`   Alerts collection exists: ${hasAlerts}`);
            } catch (e) {
                console.log(`   Error checking collections: ${e.message}`);
            }
        }

        console.log('═══════════════════════════════════════════════════\n');

    } catch (err) {
        console.error('[ERROR]', err.message);
        console.error(err.stack);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

main();
