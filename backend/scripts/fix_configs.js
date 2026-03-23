const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function fix() {
    await mongoose.connect(process.env.MONGO_URI);
    const SystemConfig = mongoose.model('SystemConfig', new mongoose.Schema({ resource: String, isActive: Boolean, costPerUnit: Number }, { collection: 'systemconfigs' }));

    // Deactivate Food
    const resFood = await SystemConfig.updateOne({ resource: 'Food' }, { $set: { isActive: false } });
    console.log('Deactivated Food:', resFood);

    // Fix Solar Cost
    const resSolar = await SystemConfig.updateOne({ resource: 'Solar' }, { $set: { costPerUnit: 12.5 } });
    console.log('Fixed Solar Cost:', resSolar);

    await mongoose.disconnect();
}
fix();
