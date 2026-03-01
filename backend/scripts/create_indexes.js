/**
 * One-time index migration script.
 * Run with: node backend/scripts/create_indexes.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  console.log('Connected to MongoDB, creating indexes...');

  // Require models to ensure schema indexes are registered
  const Usage = require('../models/Usage');
  const Alert = require('../models/Alert');
  const AuditLog = require('../models/AuditLog');
  const User = require('../models/User');
  const SystemConfig = require('../models/SystemConfig');

  try {
    await Usage.syncIndexes();
    console.log('Usage indexes ensured');
  } catch (e) { console.error('Usage index error', e.message); }

  try {
    await Alert.syncIndexes();
    console.log('Alert indexes ensured');
  } catch (e) { console.error('Alert index error', e.message); }

  try {
    await AuditLog.syncIndexes();
    console.log('AuditLog indexes ensured');
  } catch (e) { console.error('AuditLog index error', e.message); }

  try {
    await User.syncIndexes();
    console.log('User indexes ensured');
  } catch (e) { console.error('User index error', e.message); }

  try {
    await SystemConfig.syncIndexes();
    console.log('SystemConfig indexes ensured');
  } catch (e) { console.error('SystemConfig index error', e.message); }

  console.log('Index creation complete');
  process.exit(0);
}

run().catch(e => { console.error('Indexing script failed', e); process.exit(1); });
