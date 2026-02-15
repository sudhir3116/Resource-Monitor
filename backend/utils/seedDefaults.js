const SystemConfig = require('../models/SystemConfig');

const seedSystemConfig = async () => {
    try {
        const count = await SystemConfig.countDocuments();
        if (count > 0) return;

        console.log('Seeding System Defaults...');

        const defaults = [
            {
                resource: 'Electricity',
                dailyLimitPerPerson: 10, // kWh
                dailyLimitPerBlock: 500,
                monthlyLimitPerPerson: 300, // kWh per month
                monthlyLimitPerBlock: 15000,
                unit: 'kWh',
                rate: 12,
                severityThreshold: { medium: 70, high: 90, critical: 100 },
                spikeThreshold: 50,
                alertsEnabled: true
            },
            {
                resource: 'Water',
                dailyLimitPerPerson: 150, // Liters
                dailyLimitPerBlock: 50000,
                monthlyLimitPerPerson: 4500, // Liters per month
                monthlyLimitPerBlock: 1500000,
                unit: 'Liters',
                rate: 0.5,
                severityThreshold: { medium: 70, high: 90, critical: 100 },
                spikeThreshold: 50,
                alertsEnabled: true
            },
            {
                resource: 'LPG',
                dailyLimitPerPerson: 0.5, // kg (mess avg)
                dailyLimitPerBlock: 50,
                monthlyLimitPerPerson: 15, // kg per month
                monthlyLimitPerBlock: 1500,
                unit: 'kg',
                rate: 80,
                severityThreshold: { medium: 70, high: 90, critical: 100 },
                spikeThreshold: 50,
                alertsEnabled: true
            },
            {
                resource: 'Diesel',
                dailyLimitPerPerson: 0.2, // Liters (generator)
                dailyLimitPerBlock: 200,
                monthlyLimitPerPerson: 6, // Liters per month
                monthlyLimitPerBlock: 6000,
                unit: 'Liters',
                rate: 95,
                severityThreshold: { medium: 70, high: 90, critical: 100 },
                spikeThreshold: 50,
                alertsEnabled: true
            },
            {
                resource: 'Food',
                dailyLimitPerPerson: 3, // Units/Meals
                dailyLimitPerBlock: 1000,
                monthlyLimitPerPerson: 90, // Meals per month
                monthlyLimitPerBlock: 30000,
                unit: 'Meals',
                rate: 150,
                severityThreshold: { medium: 70, high: 90, critical: 100 },
                spikeThreshold: 50,
                alertsEnabled: true
            },
            {
                resource: 'Waste',
                dailyLimitPerPerson: 2, // kg
                dailyLimitPerBlock: 100,
                monthlyLimitPerPerson: 60, // kg per month
                monthlyLimitPerBlock: 3000,
                unit: 'kg',
                rate: 50, // Disposal cost per kg
                severityThreshold: { medium: 70, high: 90, critical: 100 },
                spikeThreshold: 50,
                alertsEnabled: true
            }
        ];

        await SystemConfig.insertMany(defaults);
        console.log('System Config Seeded with 6 resources (including Waste).');
    } catch (err) {
        console.error('Seed error:', err);
    }
};

module.exports = seedSystemConfig;
