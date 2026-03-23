const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const Usage = mongoose.model('Usage', new mongoose.Schema({ notes: String }, { collection: 'usages' }));
    const a = await Usage.findOne({ notes: /Warden A Solar Test/i });
    const b = await Usage.findOne({ notes: /Warden B Solar Test/i });
    console.log('Warden A Record:', a);
    console.log('Warden B Record:', b);
    await mongoose.disconnect();
}
check();
