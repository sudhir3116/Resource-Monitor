const mongoose = require('mongoose');
(async () => {
    try {
        await mongoose.connect('mongodb+srv://sudhir3116_db_user:sudhir31@cluster0.2hrasp4.mongodb.net/sustainable_resource_monitor');
        const Usage = mongoose.model('Usage', new mongoose.Schema({ resource_type: String, deleted: Boolean, usage_date: Date, usage_value: Number }));
        const results = await Usage.aggregate([
            { $match: { deleted: { $ne: true } } },
            { $group: { _id: { $toLower: '$resource_type' }, total: { $sum: '$usage_value' } } }
        ]);
        console.log('AGG_RESULTS:', JSON.stringify(results, null, 2));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
