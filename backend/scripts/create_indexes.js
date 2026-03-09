/**
 * scripts/create_indexes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Create database indexes for optimal query performance
 * Run this script after initial setup or model changes
 * 
 * Usage: node backend/scripts/create_indexes.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI not set');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  console.log('✅ Connected to MongoDB');

  // Require models to ensure schema indexes are registered
  const models = {
    Usage: require('../models/Usage'),
    Alert: require('../models/Alert'),
    AuditLog: require('../models/AuditLog'),
    User: require('../models/User'),
    SystemConfig: require('../models/SystemConfig'),
    Complaint: require('../models/Complaint'),
    PasswordResetToken: require('../models/PasswordResetToken'),
    Notification: require('../models/Notification'),
    Analytics: require('../models/Analytics'),
    Block: require('../models/Block'),
    AlertRule: require('../models/AlertRule'),
    ResourceUsage: require('../models/ResourceUsage'),
    AlertLog: require('../models/AlertLog'),
    AlertEvent: require('../models/AlertEvent'),
    Threshold: require('../models/Threshold'),
  };

  console.log('\n📊 Creating/verifying indexes...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const [name, Model] of Object.entries(models)) {
    try {
      await Model.syncIndexes();
      console.log(`✅ ${name} indexes ensured`);
      successCount++;
    } catch (e) {
      console.error(`❌ ${name} index error: ${e.message}`);
      errorCount++;
    }
  }

  // Create additional performance-critical indexes
  console.log('\n⚙️  Creating performance-critical indexes...\n');

  try {
    const Usage = require('../models/Usage');
    await Usage.collection.createIndex({ userId: 1, resource_type: 1, usage_date: 1 });
    await Usage.collection.createIndex({ blockId: 1, resource_type: 1, usage_date: 1 });
    console.log('✅ Usage compound indexes created');
  } catch (e) {
    console.warn('⚠️  Usage compound indexes already exist or error:', e.message);
  }

  try {
    const Alert = require('../models/Alert');
    await Alert.collection.createIndex({ block: 1, status: 1, severity: 1 });
    console.log('✅ Alert compound index created');
  } catch (e) {
    console.warn('⚠️  Alert compound index already exists or error:', e.message);
  }

  console.log(`\n📊 Index Creation Complete: ${successCount}/${Object.keys(models).length} models`);
  if (errorCount > 0) {
    console.warn(`⚠️  ${errorCount} models had issues`);
  }

  console.log('\n✅ All indexes are ready!');
  await mongoose.connection.close();
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
