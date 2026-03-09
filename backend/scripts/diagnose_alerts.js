#!/usr/bin/env node

/**
 * PRODUCTION ALERT DIAGNOSTIC
 * 
 * This script analyzes the actual production state and identifies
 * why alerts might not be appearing even though the system is functional.
 */

require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');

const User = require('../models/User');
const Block = require('../models/Block');
const Usage = require('../models/Usage');
const Alert = require('../models/Alert');
const SystemConfig = require('../models/SystemConfig');

async function main() {
    try {
        console.log('\n🔍 PRODUCTION ALERT DIAGNOSTIC\n');
        console.log('═'.repeat(70) + '\n');

        console.log('[1/6] Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ Connected\n');

        // Check 1: SystemConfig existence and settings
        console.log('[2/6] Checking SystemConfig for all resources...\n');
        const configs = await SystemConfig.find({});
        if (configs.length === 0) {
            console.log('❌ NO SYSTEMCONFIG FOUND!');
            console.log('   This is the problem! No thresholds configured.');
            console.log('   ACTION: Create SystemConfig documents\n');
        } else {
            configs.forEach(cfg => {
                console.log(`   ${cfg.resource}:`);
                console.log(`     ├─ isActive: ${cfg.isActive}`);
                console.log(`     ├─ alertsEnabled: ${cfg.alertsEnabled}`);
                console.log(`     ├─ dailyThreshold: ${cfg.dailyThreshold}`);
                console.log(`     ├─ monthlyThreshold: ${cfg.monthlyThreshold}`);
                console.log(`     └─ ${!cfg.isActive || !cfg.alertsEnabled ? '⚠️ ALERTS DISABLED' : '✓'}`);
            });
            console.log('');
        }

        // Check 2: Usage data
        console.log('[3/6] Checking Usage records...\n');
        const usageCount = await Usage.countDocuments();
        const activeUsageCount = await Usage.countDocuments({ deleted: { $ne: true } });
        const deletedUsageCount = await Usage.countDocuments({ deleted: true });

        console.log(`   Total Usage records: ${usageCount}`);
        console.log(`   ├─ Active (not soft-deleted): ${activeUsageCount}`);
        console.log(`   └─ Soft-deleted: ${deletedUsageCount}\n`);

        // Get recent usage samples
        const recentUsages = await Usage.find({})
            .sort({ createdAt: -1 })
            .limit(3)
            .lean();

        if (recentUsages.length > 0) {
            console.log('   Recent usage records:');
            recentUsages.forEach(u => {
                console.log(`     ├─ ${u.resource_type}: ${u.usage_value} (User: ${u.userId}, Block: ${u.blockId})`);
                console.log(`     │  └─ Date: ${u.usage_date} (deleted: ${u.deleted})`);
            });
            console.log('');
        }

        // Check 3: Alert data
        console.log('[4/6] Checking Alert records...\n');
        const alertCount = await Alert.countDocuments();
        const activeAlertCount = await Alert.countDocuments({ status: { $in: ['Active', 'Escalated'] } });
        const resolvedAlertCount = await Alert.countDocuments({ status: 'Resolved' });

        console.log(`   Total Alert records: ${alertCount}`);
        console.log(`   ├─ Active/Escalated: ${activeAlertCount}`);
        console.log(`   └─ Resolved: ${resolvedAlertCount}\n`);

        if (alertCount > 0) {
            const recentAlerts = await Alert.find({})
                .sort({ createdAt: -1 })
                .limit(3)
                .lean();

            console.log('   Recent alerts:');
            recentAlerts.forEach(a => {
                console.log(`     ├─ ${a.resourceType} (${a.severity}): Status ${a.status}`);
                console.log(`     │  └─ User: ${a.user}, Block: ${a.block}`);
            });
            console.log('');
        } else {
            console.log('   ⚠️ NO ALERTS FOUND IN DATABASE\n');
        }

        // Check 4: User/Block data
        console.log('[5/6] Checking User and Block setup...\n');
        const userCount = await User.countDocuments();
        const blockCount = await Block.countDocuments();
        const wardenCount = await User.countDocuments({ role: 'warden' });

        console.log(`   Total Users: ${userCount}`);
        console.log(`   ├─ Wardens: ${wardenCount}`);
        console.log(`   └─ Total Blocks: ${blockCount}\n`);

        // Check for users with blocks assigned
        const usersWithBlocks = await User.countDocuments({ block: { $exists: true, $ne: null } });
        console.log(`   Users with block assigned: ${usersWithBlocks}\n`);

        // Check 5: Potential issues
        console.log('[6/6] Checking for common issues...\n');

        const issues = [];

        // Issue 1: No configs
        if (configs.length === 0) {
            issues.push('❌ No SystemConfig documents - alerts cannot trigger');
        }

        // Issue 2: Alerts disabled
        const disabledConfigs = configs.filter(c => !c.alertsEnabled || !c.isActive);
        if (disabledConfigs.length > 0) {
            issues.push(`❌ Alerts disabled for: ${disabledConfigs.map(c => c.resource).join(', ')}`);
        }

        // Issue 3: No usage records
        if (usageCount === 0) {
            issues.push('❌ No usage records in database - nothing to trigger alerts');
        }

        // Issue 4: No blocks for wardens
        if (blockCount === 0 && wardenCount > 0) {
            issues.push('❌ Wardens exist but no blocks assigned');
        }

        // Issue 5: Soft-deleted records dominate
        if (deletedUsageCount > activeUsageCount && activeUsageCount > 0) {
            const ratio = (deletedUsageCount / (deletedUsageCount + activeUsageCount) * 100).toFixed(1);
            issues.push(`⚠️  ${ratio}% of usage records are soft-deleted - check if records are being prematurely deleted`);
        }

        if (issues.length === 0) {
            console.log('✅ No obvious configuration issues found');
            console.log('   System is properly configured');
            console.log('   ✓ SystemConfig exists and enabled');
            console.log('   ✓ Usage records exist');
            console.log('   ✓ Users/blocks configured\n');
            console.log('NEXT STEPS:');
            console.log('  1. Check if usage values actually exceed thresholds');
            console.log('  2. Review alert thresholds in SystemConfig');
            console.log('  3. Run the trace script: node scripts/quick_trace.js\n');
        } else {
            console.log('ISSUES FOUND:\n');
            issues.forEach(issue => console.log(`  ${issue}`));
            console.log('');
        }

        console.log('═'.repeat(70) + '\n');

        // Recommendation
        console.log('💡 RECOMMENDATION:\n');
        if (configs.length === 0) {
            console.log('   Create SystemConfig for Electricity:');
            console.log('   \n   const cfg = await SystemConfig.create({');
            console.log('       resource: "Electricity",');
            console.log('       unit: "kWh",');
            console.log('       isActive: true,');
            console.log('       alertsEnabled: true,');
            console.log('       dailyThreshold: 50,');
            console.log('       monthlyThreshold: 1000,');
            console.log('       costPerUnit: 12');
            console.log('   });\n');
        } else if (usageCount === 0) {
            console.log('   Create test usage records in MongoDB:\n');
            console.log('   db.usages.insertOne({');
            console.log('       userId: ObjectId("..."),');
            console.log('       blockId: ObjectId("..."),');
            console.log('       resource_type: "Electricity",');
            console.log('       usage_value: 120,');
            console.log('       usage_date: new Date(),');
            console.log('       deleted: false');
            console.log('   });\n');
        } else if (alertCount === 0 && activeUsageCount > 0) {
            console.log('   Alerts not triggering despite usage records.');
            console.log('   Run: node scripts/quick_trace.js\n');
            console.log('   This will create a test scenario and show exactly where\n');
            console.log('   the alert creation flow succeeds or fails.\n');
        }

    } catch (err) {
        console.error('ERROR:', err.message);
        console.error(err.stack);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

main();
