const mongoose = require('mongoose')
const path = require('path')
require('dotenv').config({
    path: path.join(__dirname, '../.env')
})

// Import models
const Usage = require('../models/Usage')
const Alert = require('../models/Alert')
const Block = require('../models/Block')
const User = require('../models/User')
const ResourceConfig = require('../models/SystemConfig')
const Complaint = require('../models/Complaint')

// ── Resource definitions ──────────────────────────────
const RESOURCES = [
    {
        name: 'Electricity',
        unit: 'kWh',
        normalDaily: 350,
        limitDaily: 400,
        spikeValue: 620,
        icon: '⚡'
    },
    {
        name: 'Water',
        unit: 'Liters',
        normalDaily: 18000,
        limitDaily: 20000,
        spikeValue: 30000,
        icon: '💧'
    },
    {
        name: 'LPG',
        unit: 'kg',
        normalDaily: 35,
        limitDaily: 45,
        spikeValue: 65,
        icon: '🔥'
    },
    {
        name: 'Diesel',
        unit: 'Liters',
        normalDaily: 50,
        limitDaily: 70,
        spikeValue: 110,
        icon: '⛽'
    },
    {
        name: 'Solar',
        unit: 'kWh',
        normalDaily: 120,
        limitDaily: 200,
        spikeValue: 30,
        icon: '☀️'
    },
    {
        name: 'Waste',
        unit: 'kg',
        normalDaily: 60,
        limitDaily: 80,
        spikeValue: 150,
        icon: '♻️'
    },
]

// ── Helper: random variation ──────────────────────────
const vary = (base, pct = 0.15) => {
    const delta = base * pct
    return Math.round(base - delta + Math.random() * delta * 2)
}

// ── Helper: date N days ago ───────────────────────────
const daysAgo = (n) => {
    const d = new Date()
    d.setDate(d.getDate() - n)
    d.setHours(8 + Math.floor(Math.random() * 4), 0, 0, 0)
    return d
}

// ── Main function ─────────────────────────────────────
async function resetAndSeed() {
    try {
        // ── Connect ────────────────────────────────────────
        await mongoose.connect(process.env.MONGO_URI)
        console.log('✅ Connected to MongoDB')
        console.log('')

        // ── Step 1: Verify prerequisites ──────────────────
        console.log('── STEP 1: Verifying prerequisites ──')

        const blocks = await Block.find({}).lean()
        const adminUser = await User.findOne({
            role: 'admin'
        }).lean()
        const wardens = await User.find({
            role: 'warden'
        }).lean()
        const students = await User.find({
            role: 'student'
        }).lean()

        console.log('Blocks found:', blocks.length,
            blocks.map(b => b.name).join(', '))
        console.log('Admin found:', adminUser?.name || 'NONE')
        console.log('Wardens found:', wardens.length)
        console.log('Students found:', students.length)
        console.log('')

        if (blocks.length === 0) {
            console.error('❌ No blocks found.')
            console.error('   Create blocks first via Admin panel.')
            process.exit(1)
        }

        if (!adminUser) {
            console.error('❌ No admin user found.')
            process.exit(1)
        }

        // ── Step 2: Safe data reset ────────────────────────
        console.log('── STEP 2: Resetting usage-related data ──')

        const deletedUsage = await Usage.deleteMany({})
        console.log('Deleted usage records:',
            deletedUsage.deletedCount)

        const deletedAlerts = await Alert.deleteMany({})
        console.log('Deleted alerts:',
            deletedAlerts.deletedCount)

        console.log('')
        console.log('✅ Collections preserved:')
        console.log('   Users ✅')
        console.log('   Blocks ✅')
        console.log('   ResourceConfig ✅')
        console.log('   Complaints ✅')
        console.log('')

        // ── Step 3: Ensure ResourceConfig has all 6 ───────
        console.log('── STEP 3: Ensuring resource configs ──')

        for (const resource of RESOURCES) {
            await ResourceConfig.findOneAndUpdate(
                { resource: resource.name },
                {
                    $setOnInsert: {
                        resource: resource.name,
                        unit: resource.unit,
                        costPerUnit: 1, // Default rate to prevent error
                        dailyThreshold: resource.limitDaily,
                        monthlyThreshold: resource.limitDaily * 30,
                        icon: resource.icon,
                        color: getColor(resource.name),
                        isActive: true
                    }
                },
                { upsert: true, new: true }
            )
            console.log('  Config ready:', resource.name,
                '(limit:', resource.limitDaily, resource.unit + ')')
        }
        console.log('')

        // ── Step 4: Seed 30 days of realistic usage ────────
        console.log('── STEP 4: Seeding 30 days of usage ──')

        const usageRecords = []

        // Use first 2 blocks for distinct test scenarios
        // If only 1 block exists — use it for both scenarios
        const blockA = blocks[0]
        const blockB = blocks[1] || blocks[0]

        // Find wardens for each block
        const wardenA = wardens.find(w =>
            w.block?.toString() === blockA._id.toString()
        )
        const wardenB = wardens.find(w =>
            w.block?.toString() === blockB._id.toString()
        )

        const loggedByA = wardenA?._id || adminUser._id
        const loggedByB = wardenB?._id || adminUser._id

        // ─ Block A: Normal usage with occasional overuse ──
        for (let day = 30; day >= 0; day--) {
            const date = daysAgo(day)

            for (const resource of RESOURCES) {
                // Spike on days 0, 7, 14, 21 (weekly)
                const isSpike = day % 7 === 0
                const value = isSpike
                    ? vary(resource.spikeValue, 0.1)
                    : vary(resource.normalDaily, 0.15)

                usageRecords.push({
                    blockId: blockA._id,
                    resource_type: resource.name,
                    usage_value: value,
                    unit: resource.unit,
                    usage_date: date,
                    createdBy: loggedByA,
                    isVerified: true,
                    deleted: false,
                    notes: isSpike
                        ? `Weekly spike — ${resource.name} high usage`
                        : `Regular daily usage — ${resource.name}`
                })
            }
        }

        // ─ Block B: High usage scenario (if different block)
        if (blockB._id.toString() !== blockA._id.toString()) {
            for (let day = 30; day >= 0; day--) {
                const date = daysAgo(day)
                date.setHours(date.getHours() + 2)

                for (const resource of RESOURCES) {
                    // Block B consistently uses 130% of normal
                    const isOveruse = day % 5 === 0
                    const baseValue = isOveruse
                        ? resource.spikeValue
                        : resource.normalDaily * 1.3
                    const value = vary(baseValue, 0.1)

                    usageRecords.push({
                        blockId: blockB._id,
                        resource_type: resource.name,
                        usage_value: value,
                        unit: resource.unit,
                        usage_date: date,
                        createdBy: loggedByB,
                        isVerified: true,
                        deleted: false,
                        notes: isOveruse
                            ? `Overuse detected — ${resource.name}`
                            : `Above average usage — ${resource.name}`
                    })
                }
            }
        }

        // ─ Insert all usage records ───────────────────────
        const insertedUsage = await Usage.insertMany(
            usageRecords, { ordered: false }
        )
        console.log('Usage records inserted:',
            insertedUsage.length)
        console.log('  Block A:', blockA.name,
            '— 30 days × 6 resources')
        if (blockB._id.toString() !== blockA._id.toString()) {
            console.log('  Block B:', blockB.name,
                '— 30 days × 6 resources')
        }
        console.log('')

        // ── Step 5: Create realistic alerts ───────────────
        console.log('── STEP 5: Creating alerts ──')

        const alertsToCreate = []

        // Alert scenarios across multiple days
        const alertScenarios = [
            {
                block: blockA._id,
                blockName: blockA.name,
                resource: 'Electricity',
                usage: 420,
                limit: 400,
                pct: 105,
                severity: 'High',
                status: 'Active',
                daysAgoN: 0,
                message: `Electricity usage exceeded daily limit in ${blockA.name}. Used: 420 kWh / Limit: 400 kWh`
            },
            {
                block: blockA._id,
                blockName: blockA.name,
                resource: 'Water',
                usage: 22000,
                limit: 20000,
                pct: 110,
                severity: 'High',
                status: 'Investigating',
                daysAgoN: 1,
                message: `Water usage exceeded daily limit in ${blockA.name}. Used: 22000 L / Limit: 20000 L`
            },
            {
                block: blockB._id,
                blockName: blockB.name,
                resource: 'Electricity',
                usage: 620,
                limit: 400,
                pct: 155,
                severity: 'Critical',
                status: 'Active',
                daysAgoN: 0,
                message: `CRITICAL: Electricity critically high in ${blockB.name}. Used: 620 kWh / Limit: 400 kWh`
            },
            {
                block: blockB._id,
                blockName: blockB.name,
                resource: 'Water',
                usage: 30000,
                limit: 20000,
                pct: 150,
                severity: 'High',
                status: 'Escalated',
                daysAgoN: 2,
                message: `Water usage critically high in ${blockB.name}. Used: 30000 L / Limit: 20000 L`
            },
            {
                block: blockB._id,
                blockName: blockB.name,
                resource: 'Waste',
                usage: 150,
                limit: 80,
                pct: 188,
                severity: 'High',
                status: 'Active',
                daysAgoN: 1,
                message: `Waste disposal exceeded limit in ${blockB.name}. Used: 150 kg / Limit: 80 kg`
            },
            {
                block: blockA._id,
                blockName: blockA.name,
                resource: 'LPG',
                usage: 65,
                limit: 45,
                pct: 144,
                severity: 'High',
                status: 'Resolved',
                daysAgoN: 7,
                message: `LPG usage exceeded in ${blockA.name}. Used: 65 kg / Limit: 45 kg`
            },
        ]

        for (const scenario of alertScenarios) {
            const alertDate = daysAgo(scenario.daysAgoN)
            alertsToCreate.push({
                block: scenario.block,
                resourceType: scenario.resource,
                alertType: 'daily',
                severity: scenario.severity,
                status: scenario.status,
                message: scenario.message,
                totalUsage: scenario.usage,
                dailyLimit: scenario.limit,
                calculatedPercentage: scenario.pct,
                alertDate: alertDate,
            })
        }

        const insertedAlerts = await Alert.insertMany(
            alertsToCreate, { ordered: false }
        )
        console.log('Alerts created:', insertedAlerts.length)
        alertsToCreate.forEach(a => {
            console.log(
                `  [${a.severity.toUpperCase()}]`,
                a.resourceType,
                '→', a.status,
                '(' + a.calculatedPercentage + '% of limit)'
            )
        })
        console.log('')

        // ── Step 6: Create sample complaints ──────────────
        console.log('── STEP 6: Creating sample complaints ──')

        // Find a student user
        const studentUser = students[0] || adminUser

        const sampleComplaints = [
            {
                title: 'Water supply disrupted in Block A',
                description: 'Water supply has been disrupted since morning. Students are unable to use washrooms. Immediate action required.',
                user: studentUser._id,
                status: 'open',
                category: 'plumbing',
                priority: 'urgent'
            },
            {
                title: 'Electricity fluctuation in corridor',
                description: 'Lights in the main corridor keep flickering. Multiple students have reported this issue over the past 3 days.',
                user: studentUser._id,
                status: 'in_progress',
                category: 'electrical',
                priority: 'high'
            },
            {
                title: 'WiFi not working on floor 2',
                description: 'Internet connectivity has been down on floor 2 for 2 days. Students are unable to attend online classes.',
                user: studentUser._id,
                status: 'under_review',
                category: 'internet',
                priority: 'high'
            },
            {
                title: 'Common area needs cleaning',
                description: 'The common area on floor 3 has not been cleaned for 3 days. Waste is accumulating near the entrance.',
                user: studentUser._id,
                status: 'open',
                category: 'cleanliness',
                priority: 'medium'
            },
        ]

        // Only create if no complaints exist
        const existingComplaints = await Complaint.countDocuments()
        if (existingComplaints === 0) {
            await Complaint.insertMany(sampleComplaints)
            console.log('Complaints created:',
                sampleComplaints.length)
        } else {
            console.log('Complaints already exist:',
                existingComplaints, '— skipping')
        }
        console.log('')

        // ── Step 7: Final summary ──────────────────────────
        console.log('════════════════════════════════════')
        console.log('✅ SEED COMPLETE — FINAL SUMMARY')
        console.log('════════════════════════════════════')
        console.log('')

        const finalUsage = await Usage.countDocuments()
        const finalAlerts = await Alert.countDocuments()
        const finalComplaints = await Complaint.countDocuments()
        const finalBlocks = await Block.countDocuments()
        const finalUsers = await User.countDocuments()

        console.log('DATABASE STATE:')
        console.log('  Usage records:  ', finalUsage)
        console.log('  Alerts:         ', finalAlerts)
        console.log('  Complaints:     ', finalComplaints)
        console.log('  Blocks:         ', finalBlocks,
            '(preserved ✅)')
        console.log('  Users:          ', finalUsers,
            '(preserved ✅)')
        console.log('')

        console.log('ALERT BREAKDOWN:')
        const openAlerts = await Alert.countDocuments({
            status: 'Active'
        })
        const criticalAlerts = await Alert.countDocuments({
            severity: 'Critical'
        })
        const resolvedAlerts = await Alert.countDocuments({
            status: 'Resolved'
        })
        console.log('  Open:     ', openAlerts)
        console.log('  Critical: ', criticalAlerts)
        console.log('  Resolved: ', resolvedAlerts)
        console.log('')

        console.log('BLOCKS SEEDED:')
        blocks.forEach(b => {
            console.log('  ', b.name, '—', b._id.toString())
        })
        console.log('')

        console.log('RESOURCES COVERED:')
        RESOURCES.forEach(r => {
            console.log(' ', r.icon, r.name,
                '— limit:', r.limitDaily, r.unit)
        })
        console.log('')

        console.log('EXPECTED ROLE VIEWS:')
        console.log('  Admin/GM     → all blocks, all data')
        console.log('  Dean         → all blocks, read only')
        console.log('  Principal    → summary only, no alerts')
        console.log('  Warden A     →', blockA.name, 'only')
        if (blockB._id.toString() !== blockA._id.toString()) {
            console.log('  Warden B     →', blockB.name, 'only')
        }
        console.log('  Student      → their block only')
        console.log('')

        console.log('NOW TEST IN BROWSER:')
        console.log('  1. Open http://localhost:5173')
        console.log('  2. Login as each role below')
        console.log('  3. Verify data matches expected')
        console.log('')
        console.log('TEST CREDENTIALS:')
        console.log('  Admin:     admin@college.com / Admin@123')
        console.log('  GM:        gm@college.com / GM@123')
        console.log('  Warden:    warden-1@college.com / Warden@123')
        console.log('  Student:   student-1@college.com / Student@123')
        console.log('  Dean:      dean@college.com / Dean@123')
        console.log('  Principal: principal@college.com / Principal@123')

    } catch (err) {
        console.error('❌ Seed error:', err.message)
        if (err.writeErrors) {
            console.error('Write errors:', err.writeErrors.length)
        }
    } finally {
        await mongoose.disconnect()
        console.log('')
        console.log('Disconnected from MongoDB')
    }
}

// ── Helper: get color per resource ────────────────────
function getColor(name) {
    const colors = {
        Electricity: '#F59E0B',
        Water: '#3B82F6',
        LPG: '#EF4444',
        Diesel: '#8B5CF6',
        Solar: '#10B981',
        Waste: '#6B7280'
    }
    return colors[name] || '#64748b'
}

resetAndSeed()
