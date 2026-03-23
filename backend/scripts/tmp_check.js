const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function check() {
    await mongoose.connect(process.env.MONGO_URI);
    const SystemConfig = mongoose.model('SystemConfig', new mongoose.Schema({ resource: String, isActive: { type: Boolean, default: true } }, { collection: 'systemconfigs' }));
    const configs = await SystemConfig.find({});
    console.log(JSON.stringify(configs, null, 2));
    await mongoose.disconnect();
}
check();
