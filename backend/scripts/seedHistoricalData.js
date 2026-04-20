/**
 * seedHistoricalData.js
 * ─────────────────────────────────────────────────────────────
 * Generates realistic historical resource usage data (April 1–19 2026),
 * replaces all "System" loggedBy fields with real user ObjectIds,
 * and adds sample complaints / announcements with proper user references.
 *
 * Usage:
 *   node scripts/seedHistoricalData.js
 *
 * Safe to re-run: skips days that already have usage records.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const Usage        = require('../models/Usage');
const User         = require('../models/User');
const Block        = require('../models/Block');
const ResourceConfig = require('../models/ResourceConfig');
const Complaint    = require('../models/Complaint');
const Announcement = require('../models/Announcement');

// ─── helpers ────────────────────────────────────────────────
const rand = (min, max) => +(Math.random() * (max - min) + min).toFixed(2);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Realistic value ranges per resource type (daily per-block)
const RESOURCE_RANGES = {
  Electricity : { min: 280,  max: 480  },  // kWh
  Water       : { min: 8000, max: 18000 }, // Liters
  Diesel      : { min: 30,   max: 90   },  // Liters
  LPG         : { min: 20,   max: 60   },  // kg
  Waste       : { min: 40,   max: 120  },  // kg
  Petrol      : { min: 15,   max: 45   },  // Liters
  Kerosene    : { min: 10,   max: 35   },  // Liters
  Solar       : { min: 80,   max: 200  },  // kWh
};

// Complaint topic pools
const COMPLAINT_TITLES = [
  'Water leakage in washroom',
  'Electricity outage in room',
  'Internet connectivity issue',
  'Dirty common area',
  'Security door broken',
  'Blocked drainage',
  'Fan not working',
  'Light bulb replacement needed',
  'Hot water not available',
  'Noise disturbance at night',
];
const COMPLAINT_DESCRIPTIONS = [
  'The issue has been persisting for more than 2 days and needs urgent attention.',
  'Multiple students are affected. Please arrange for immediate repair.',
  'This has been reported earlier but not resolved. Escalating again.',
  'The situation is causing inconvenience to residents and needs prompt action.',
  'Maintenance team visited but problem is still present. Please revisit.',
];
const COMPLAINT_CATEGORIES = ['plumbing', 'electrical', 'internet', 'cleanliness', 'security', 'other'];
const COMPLAINT_PRIORITIES  = ['low', 'medium', 'high', 'urgent'];
const COMPLAINT_STATUSES    = ['open', 'under_review', 'in_progress', 'resolved'];

// Announcement pool
const ANNOUNCEMENT_DATA = [
  {
    title: 'Water Conservation Drive – April 2026',
    content: 'All residents are requested to minimise water usage during peak hours (8–10 AM and 6–8 PM). Regular audits will be conducted.',
    type: 'RESOURCE', priority: 'HIGH',
  },
  {
    title: 'Electricity Maintenance on April 5',
    content: 'Scheduled maintenance for the main electrical panel will take place on April 5 from 10 AM to 1 PM. Please arrange accordingly.',
    type: 'MAINTENANCE', priority: 'URGENT',
  },
  {
    title: 'Monthly Sustainability Report – March 2026',
    content: 'The campus achieved 12% reduction in electricity consumption compared to previous month. Keep up the great work!',
    type: 'GENERAL', priority: 'MEDIUM',
  },
  {
    title: 'LPG Safety Inspection Notice',
    content: 'A safety inspection for all LPG connections will be conducted on April 10. Wardens must be present during inspection.',
    type: 'MAINTENANCE', priority: 'HIGH',
  },
  {
    title: 'Earth Day Celebration – April 22',
    content: 'Join us for the campus Earth Day event. Activities include a tree-planting drive, awareness walk, and eco-quiz.',
    type: 'EVENT', priority: 'MEDIUM',
  },
];

// ─── main ───────────────────────────────────────────────────
async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGO_URI / MONGODB_URI not set in .env');
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ MongoDB connected');

  // ── 1. Fetch reference data ──────────────────────────────
  const wardens  = await User.find({ role: { $in: ['warden', 'Warden'] }, isApproved: true }).lean();
  const students = await User.find({ role: { $in: ['student', 'Student'] }, isApproved: true }).lean();
  const admins   = await User.find({ role: { $in: ['admin', 'gm', 'Admin', 'GM'] } }).lean();
  const blocks   = await Block.find({ status: { $ne: 'Closed' } }).lean();
  const resources = await ResourceConfig.find({ isActive: true, isDeleted: { $ne: true } }).lean();

  if (!wardens.length)  console.warn('⚠️  No approved wardens found – usage will be attributed to first admin.');
  if (!students.length) console.warn('⚠️  No approved students found – complaints will be skipped.');
  if (!admins.length)   console.warn('⚠️  No admin/gm found – announcements will be skipped.');
  if (!blocks.length)   { console.error('❌ No blocks found. Seed blocks first.'); process.exit(1); }
  if (!resources.length){ console.error('❌ No active resources found. Seed ResourceConfig first.'); process.exit(1); }

  const fallbackUser = admins[0] || wardens[0];

  console.log(`\n👥 Wardens: ${wardens.length}  Students: ${students.length}  Admins: ${admins.length}`);
  console.log(`🏠 Blocks: ${blocks.length}   Resources: ${resources.length}`);

  // ── 2. TASK 3: Fix existing "System" loggedBy ────────────
  console.log('\n🔧 Fixing existing records with loggedBy = "System" …');

  // Usage – assign wardens (or fallback admin)
  const usageSystemDocs = await Usage.find({
    $or: [{ createdBy: null }, { userId: null }],
    deleted: { $ne: true }
  }).lean();

  let fixedUsage = 0;
  for (const doc of usageSystemDocs) {
    // Try to find a warden assigned to the same block
    let assignUser = wardens.length
      ? pick(wardens)
      : fallbackUser;

    // Prefer warden of the same block
    if (wardens.length && doc.blockId) {
      const blockWarden = wardens.find(w => String(w.block) === String(doc.blockId));
      if (blockWarden) assignUser = blockWarden;
    }

    await Usage.updateOne({ _id: doc._id }, {
      $set: {
        createdBy: assignUser._id,
        userId: assignUser._id,
      }
    });
    fixedUsage++;
  }
  console.log(`   ✅ Fixed ${fixedUsage} usage records`);

  // Complaints – assign students
  if (students.length) {
    const complaintDocs = await Complaint.find({ user: null }).lean();
    for (const doc of complaintDocs) {
      await Complaint.updateOne({ _id: doc._id }, {
        $set: { user: pick(students)._id }
      });
    }
    console.log(`   ✅ Fixed ${complaintDocs.length} complaint user references`);
  }

  // Announcements – assign admins
  if (admins.length) {
    const annDocs = await Announcement.find({ createdBy: null }).lean();
    for (const doc of annDocs) {
      await Announcement.updateOne({ _id: doc._id }, {
        $set: { createdBy: pick(admins)._id }
      });
    }
    console.log(`   ✅ Fixed ${annDocs.length} announcement references`);
  }

  // ── 3. TASK 4: Generate historical usage data ────────────
  console.log('\n📊 Generating historical usage data (April 1–19, 2026) …');

  const START_DATE = new Date('2026-04-01T00:00:00.000Z');
  const END_DATE   = new Date('2026-04-19T23:59:59.000Z');

  let totalInserted = 0;

  for (let d = new Date(START_DATE); d <= END_DATE; d.setDate(d.getDate() + 1)) {
    const dayStr = d.toISOString().split('T')[0];

    for (const block of blocks) {
      // Check if any usage already exists for this block+day
      const dayStart = new Date(`${dayStr}T00:00:00.000Z`);
      const dayEnd   = new Date(`${dayStr}T23:59:59.999Z`);

      const existing = await Usage.countDocuments({
        blockId: block._id,
        usage_date: { $gte: dayStart, $lte: dayEnd },
        deleted: { $ne: true }
      });

      if (existing > 0) {
        process.stdout.write('.');
        continue; // Already seeded – skip
      }

      // Pick a warden for this block
      let assignedWarden = wardens.length ? pick(wardens) : fallbackUser;
      const blockWarden = wardens.find(w => String(w.block) === String(block._id));
      if (blockWarden) assignedWarden = blockWarden;

      const usageDocs = [];

      for (const resource of resources) {
        const range = RESOURCE_RANGES[resource.name];
        if (!range) continue; // Unknown resource – skip

        // Vary usage slightly by day-of-week (weekends lower)
        const dayOfWeek = new Date(dayStr).getDay(); // 0=Sun,6=Sat
        const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.75 : 1.0;

        const usageValue = rand(range.min * weekendFactor, range.max * weekendFactor);
        const costPerUnit = resource.costPerUnit || 0;
        const cost = +(usageValue * costPerUnit).toFixed(2);

        // Random time during business hours for realism
        const hour = Math.floor(Math.random() * 12) + 7; // 7 AM – 6 PM
        const min  = Math.floor(Math.random() * 60);
        const usageDate = new Date(`${dayStr}T${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}:00.000Z`);

        usageDocs.push({
          blockId     : block._id,
          userId      : assignedWarden._id,
          resourceId  : resource._id,
          resource_type: resource.name,
          usage_value : usageValue,
          unit        : resource.unit || 'units',
          cost,
          usage_date  : usageDate,
          notes       : `Daily reading – ${resource.name} for ${block.name}`,
          source      : 'MANUAL',
          createdBy   : assignedWarden._id,
          lastUpdatedBy: assignedWarden._id,
          isVerified  : true,
          isDuplicate : false,
          deleted     : false,
        });
      }

      if (usageDocs.length > 0) {
        await Usage.insertMany(usageDocs, { ordered: false });
        totalInserted += usageDocs.length;
        process.stdout.write('+');
      }
    }
  }

  console.log(`\n   ✅ Inserted ${totalInserted} usage records`);

  // ── 4. Generate sample complaints ───────────────────────
  if (students.length && blocks.length) {
    console.log('\n📝 Generating sample complaints …');
    const existingComplaints = await Complaint.countDocuments({
      createdAt: { $gte: new Date('2026-04-01'), $lte: new Date('2026-04-19T23:59:59Z') }
    });

    if (existingComplaints < 10) {
      const complaintInserts = [];
      for (let i = 0; i < 15; i++) {
        const student = pick(students);
        const block   = student.block
          ? blocks.find(b => String(b._id) === String(student.block)) || pick(blocks)
          : pick(blocks);

        const day = new Date('2026-04-01');
        day.setDate(day.getDate() + Math.floor(Math.random() * 19));

        complaintInserts.push({
          title       : pick(COMPLAINT_TITLES),
          description : pick(COMPLAINT_DESCRIPTIONS),
          user        : student._id,
          blockId     : block._id,
          category    : pick(COMPLAINT_CATEGORIES),
          priority    : pick(COMPLAINT_PRIORITIES),
          status      : pick(COMPLAINT_STATUSES),
          createdAt   : day,
          updatedAt   : day,
          history     : [{
            action     : 'created',
            performedBy: student._id,
            note       : 'Complaint submitted by student',
            timestamp  : day
          }]
        });
      }
      await Complaint.insertMany(complaintInserts, { ordered: false });
      console.log(`   ✅ Inserted ${complaintInserts.length} sample complaints`);
    } else {
      console.log(`   ℹ️  Skipped – ${existingComplaints} complaints already exist`);
    }
  }

  // ── 5. Generate announcements ────────────────────────────
  if (admins.length) {
    console.log('\n📢 Generating announcements …');
    const existingAnn = await Announcement.countDocuments({
      createdAt: { $gte: new Date('2026-04-01') }
    });

    if (existingAnn < 3) {
      const annInserts = ANNOUNCEMENT_DATA.map((a, i) => {
        const admin = pick(admins);
        const day = new Date('2026-04-01');
        day.setDate(day.getDate() + i * 3);
        return {
          ...a,
          targetRole: ['all'],
          targetBlock: null,
          createdBy: admin._id,
          pinned: i === 0,
          expiresAt: null,
          createdAt: day,
          updatedAt: day,
        };
      });
      await Announcement.insertMany(annInserts, { ordered: false });
      console.log(`   ✅ Inserted ${annInserts.length} announcements`);
    } else {
      console.log(`   ℹ️  Skipped – ${existingAnn} announcements already exist`);
    }
  }

  // ── 6. Summary ───────────────────────────────────────────
  const totalUsage = await Usage.countDocuments({ deleted: { $ne: true } });
  const totalComplaints = await Complaint.countDocuments();
  const totalAnn = await Announcement.countDocuments();

  console.log('\n────────────────────────────────────────');
  console.log('✅ Seeding complete!');
  console.log(`   Total Usage Records  : ${totalUsage}`);
  console.log(`   Total Complaints     : ${totalComplaints}`);
  console.log(`   Total Announcements  : ${totalAnn}`);
  console.log('────────────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Seed failed:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
