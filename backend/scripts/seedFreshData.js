const mongoose = require('mongoose')
const path = require('path')
require('dotenv').config({
  path: path.join(__dirname, '../.env')
})

async function seed() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI
  if (!mongoUri) {
    console.error('❌ No MONGO_URI or MONGODB_URI found in .env')
    process.exit(1)
  }

  await mongoose.connect(mongoUri)
  console.log('✅ Connected to MongoDB')

  const Usage = require('../models/Usage')
  const Alert = require('../models/Alert')
  const Block = require('../models/Block')
  const User = require('../models/User')
  const RC = require('../models/ResourceConfig')

  const blocks = await Block.find({}).lean()
  const admin = await User.findOne({ role: 'admin' }).lean()
  const configs = await RC.find({ isActive: true }).lean()

  if (!blocks.length) {
    console.error('❌ No blocks found.')
    console.error('   Create blocks via admin panel first (/admin/blocks).')
    process.exit(1)
  }

  if (!admin) {
    console.error('❌ No admin user found.')
    process.exit(1)
  }

  if (!configs.length) {
    console.error('❌ No active resource configs found.')
    console.error('   Start the backend first so ResourceConfig gets seeded.')
    process.exit(1)
  }

  // Clear usage and alerts only
  await Usage.deleteMany({})
  await Alert.deleteMany({})
  console.log('✅ Cleared usage and alerts')

  // Seed 30 days of realistic data
  const records = []
  const now = new Date()

  for (const block of blocks) {
    const warden = await User.findOne({ role: 'warden', block: block._id }).lean()
    const by = warden?._id || admin._id

    for (let day = 30; day >= 0; day--) {
      const date = new Date(now)
      date.setDate(date.getDate() - day)
      date.setHours(8, 0, 0, 0)

      for (const cfg of configs) {
        const isSpike = day % 7 === 0
        const base = isSpike
          ? cfg.dailyLimit * 1.6
          : cfg.dailyLimit * 0.8
        const v = Math.round(base * (0.85 + Math.random() * 0.3) * 10) / 10

        records.push({
          blockId: block._id,
          resource_type: cfg.name,
          usage_value: v,
          unit: cfg.unit,
          usage_date: new Date(date),
          createdBy: by,
          deleted: false,
          isVerified: true
        })
      }
    }
  }

  await Usage.insertMany(records, { ordered: false })
  console.log(`✅ Inserted ${records.length} usage records`)

  // Create spike alerts
  const alertDocs = [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (const block of blocks) {
    for (const cfg of configs) {
      alertDocs.push({
        block: block._id,
        resourceType: cfg.name,
        alertType: 'daily',
        severity: 'High',
        status: 'Active',
        message: `${cfg.name} exceeded daily limit in ${block.name}`,
        totalUsage: Math.round(cfg.dailyLimit * 1.6),
        dailyLimit: cfg.dailyLimit,
        calculatedPercentage: 160,
        alertDate: today,
        isRead: false
      });
    }
  }

  try {
    const result = await Alert.insertMany(alertDocs, { ordered: false });
    console.log(`✅ Created ${result.length} alerts`);
  } catch (e) {
    // E11000 duplicate key: safe to ignore — some alerts may already exist
    const inserted = e.result?.nInserted || e.insertedDocs?.length || 0;
    console.log(`✅ Alerts inserted: ${inserted} (${alertDocs.length - inserted} skipped as duplicate)`);
  }

  console.log('\n════════════ SEED COMPLETE ════════════')
  console.log(`Blocks:    ${blocks.length}`)
  console.log(`Resources: ${configs.length}`)
  console.log(`Records:   ${records.length}`)
  console.log(`Alerts:    ${alertDocs.length}`)
  await mongoose.disconnect()
  console.log('✅ Disconnected from MongoDB')
}

seed().catch(e => {
  console.error('Seed failed:', e.message)
  process.exit(1)
})
