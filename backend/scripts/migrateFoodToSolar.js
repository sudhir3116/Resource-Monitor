const mongoose = require('mongoose')
const path = require('path')
require('dotenv').config({
    path: path.join(__dirname, '../../.env')
})

async function migrate() {
    await mongoose.connect('mongodb://127.0.0.1:27017/ecomonitor')
    console.log('Connected to MongoDB')

    const db = mongoose.connection.db
    const result = await db.collection('usages').updateMany(
        { resource_type: 'Food' },
        { $set: { resource_type: 'Solar' } }
    )
    console.log('Migrated Food → Solar:',
        result.modifiedCount, 'records')

    await mongoose.disconnect()
    console.log('Done')
}

migrate().catch(console.error)
