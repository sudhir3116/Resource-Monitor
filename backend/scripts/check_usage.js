const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const Usage = mongoose.model('Usage', new mongoose.Schema({ resource_type: String, usage_value: Number, notes: String }, { collection: 'usages' }));
    const record = await Usage.findOne({ notes: /Refractive solar telemetry test/i });
    console.log(JSON.stringify(record, null, 2));
    await mongoose.disconnect();
}
check();
