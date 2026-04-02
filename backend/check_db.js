const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function checkDb() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const User = require('./models/User');
        const Block = require('./models/Block');
        const Usage = require('./models/Usage');
        const Resource = require('./models/Resource');

        const resources = await Resource.find().lean();
        console.log('Resources in DB:', JSON.stringify(resources, null, 2));

        const userCountAll = await User.countDocuments();
        const userCountFiltered = await User.countDocuments({ deleted: { $ne: true } });
        const blockCount = await Block.countDocuments();
        const usageCount = await Usage.countDocuments();

        console.log(`Users (All): ${userCountAll}`);
        console.log(`Users (Filtered): ${userCountFiltered}`);
        console.log(`Blocks: ${blockCount}`);
        console.log(`Usage Records: ${usageCount}`);

        const sampleUsage = await Usage.findOne().lean();
        console.log('Sample Usage:', JSON.stringify(sampleUsage, null, 2));

        const sampleUser = await User.findOne({ email: 'admin@college.com' }).lean();
        console.log('Admin User:', JSON.stringify(sampleUser, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDb();
