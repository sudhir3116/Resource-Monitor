/**
 * services/sustainabilityService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Sustainability insights, recommendations, and conservation tracking
 */

const Recommendation = require('../models/Recommendation');
const Usage = require('../models/Usage');
const ResourceConfig = require('../models/ResourceConfig');
const mongoose = require('mongoose');

/**
 * Get personalized sustainability recommendations for a block/user
 */
exports.getRecommendations = async (options = {}) => {
    const { blockId, role, userId, limit = 10 } = options;

    const recommendations = [];

    // Fetch recent usage patterns
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let usageFilter = { 
        deleted: { $ne: true },
        usage_date: { $gte: thirtyDaysAgo, $lte: now }
    };

    if (blockId) {
        usageFilter.blockId = new mongoose.Types.ObjectId(blockId.toString());
    } else if (userId && role === 'student') {
        usageFilter.userId = new mongoose.Types.ObjectId(userId.toString());
    }

    const usageStats = await Usage.aggregate([
        { $match: usageFilter },
        {
            $group: {
                _id: '$resource_type',
                total: { $sum: '$usage_value' },
                count: { $sum: 1 },
                avgValue: { $avg: '$usage_value' },
                maxValue: { $max: '$usage_value' }
            }
        },
        { $sort: { total: -1 } }
    ]);

    // Get thresholds from ResourceConfig
    const configs = await ResourceConfig.find({ isActive: { $ne: false } }).lean();
    const configMap = {};
    configs.forEach(c => configMap[c.name] = c);

    // Generate recommendations based on usage
    usageStats.forEach(stat => {
        const resource = stat._id;
        const config = configMap[resource];
        const dailyAvg = stat.total / 30;

        // Water conservation
        if (resource === 'Water' && dailyAvg > 0) {
            if (dailyAvg > (config?.dailyLimit || 200) * 0.8) {
                recommendations.push({
                    resource,
                    type: 'conservation',
                    severity: 'high',
                    title: 'Reduce Water Usage',
                    description: 'Your water consumption is 80% above average. Consider fixing leaks and using efficient fixtures.',
                    actions: [
                        'Check for leaking taps',
                        'Install low-flow showerheads',
                        'Use bucket instead of hose for cleaning',
                        'Fix running toilets',
                        'Mulch plants to retain moisture'
                    ],
                    impact: '↓ 30-40% of water usage',
                    priority: 1,
                    score: Math.round((dailyAvg / (config?.dailyLimit || 200)) * 100)
                });
            } else if (dailyAvg > (config?.dailyLimit || 200) * 0.5) {
                recommendations.push({
                    resource,
                    type: 'optimization',
                    severity: 'medium',
                    title: 'Optimize Water Usage',
                    description: 'Implement water-saving practices to reduce consumption.',
                    actions: [
                        'Turn off water while brushing teeth',
                        'Take shorter showers',
                        'Fix minor leaks promptly',
                        'Update to water-efficient appliances'
                    ],
                    impact: '↓ 15-25% of water usage',
                    priority: 2,
                    score: Math.round((dailyAvg / (config?.dailyLimit || 200)) * 100)
                });
            }
        }

        // Electricity conservation
        if (resource === 'Electricity' && dailyAvg > 0) {
            if (dailyAvg > (config?.dailyLimit || 100) * 0.8) {
                recommendations.push({
                    resource,
                    type: 'conservation',
                    severity: 'high',
                    title: 'Reduce Electricity Usage',
                    description: 'Your electricity consumption is significantly high. Implement energy efficiency measures.',
                    actions: [
                        'Switch to LED lights (save 75% energy)',
                        'Use power strips and turn off standby devices',
                        'Set AC to 24-26°C',
                        'Use natural light during day',
                        'Unplug chargers when not in use',
                        'Maintain AC filters monthly'
                    ],
                    impact: '↓ 25-35% of electricity usage',
                    priority: 1,
                    score: Math.round((dailyAvg / (config?.dailyLimit || 100)) * 100)
                });
            } else if (dailyAvg > (config?.dailyLimit || 100) * 0.5) {
                recommendations.push({
                    resource,
                    type: 'optimization',
                    severity: 'medium',
                    title: 'Optimize Electricity Usage',
                    description: 'Adopt energy-efficient habits.',
                    actions: [
                        'Use LED bulbs',
                        'Turn off lights when leaving room',
                        'Set AC to slightly higher temperature',
                        'Use fans instead of AC when possible',
                        'Keep refrigerator coils clean'
                    ],
                    impact: '↓ 10-20% of electricity usage',
                    priority: 2,
                    score: Math.round((dailyAvg / (config?.dailyLimit || 100)) * 100)
                });
            }
        }

        // LPG conservation
        if (resource === 'LPG' && dailyAvg > 0) {
            if (dailyAvg > (config?.dailyLimit || 20) * 0.8) {
                recommendations.push({
                    resource,
                    type: 'conservation',
                    severity: 'high',
                    title: 'Reduce Gas Usage',
                    description: 'Your gas consumption is high. Optimize cooking and heating methods.',
                    actions: [
                        'Use pressure cooker (33% faster)',
                        'Maintain stove burner cleanliness',
                        'Use lids when cooking',
                        'Insulate water heating',
                        'Use energy-efficient cooking methods'
                    ],
                    impact: '↓ 20-30% of gas usage',
                    priority: 1,
                    score: Math.round((dailyAvg / (config?.dailyLimit || 20)) * 100)
                });
            }
        }

        // Waste reduction
        if (resource === 'Waste' && dailyAvg > 0) {
            recommendations.push({
                resource,
                type: 'reduction',
                severity: 'medium',
                title: 'Reduce Waste Generation',
                description: 'Minimize waste through recycling and composting.',
                actions: [
                    'Separate recyclable materials',
                    'Compost organic waste',
                    'Use reusable containers',
                    'Reduce single-use plastics',
                    'Donate or reuse items'
                ],
                impact: '↓ 40-50% of waste volume',
                priority: 2,
                score: Math.round((dailyAvg / (config?.dailyLimit || 50)) * 100)
            });
        }
    });

    // Sort by priority and return limited results
    return recommendations
        .sort((a, b) => a.priority - b.priority || b.severity === 'high' ? -1 : 1)
        .slice(0, limit)
        .map(rec => ({
            ...rec,
            timestamp: new Date(),
            viewed: false
        }));
};

/**
 * Calculate carbon footprint based on resource usage
 * CO2 emission factors (kg CO2 per unit):
 * - Electricity: 0.92 kg per kWh (average India grid)
 * - Water: 0.0011 kg per liter
 * - LPG: 3.0 kg per kg of gas
 * - Diesel: 2.68 kg per liter
 */
exports.calculateCarbonFootprint = async (options = {}) => {
    const { blockId, startDate, endDate } = options;

    const matchStage = {
        deleted: { $ne: true }
    };

    if (blockId) {
        matchStage.blockId = new mongoose.Types.ObjectId(blockId.toString());
    }

    if (startDate || endDate) {
        matchStage.usage_date = {};
        if (startDate) matchStage.usage_date.$gte = new Date(startDate);
        if (endDate) matchStage.usage_date.$lte = new Date(endDate);
    }

    const usageData = await Usage.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$resource_type',
                total: { $sum: '$usage_value' }
            }
        }
    ]);

    const emissionFactors = {
        'Electricity': 0.92,
        'Water': 0.0011,
        'LPG': 3.0,
        'Diesel': 2.68,
        'Solar': -0.92, // Negative emissions (avoided)
        'Waste': 0.5 // kg per item
    };

    let totalCO2 = 0;
    const breakdown = {};

    usageData.forEach(resource => {
        const factor = emissionFactors[resource._id] || 0;
        const co2 = resource.total * factor;
        breakdown[resource._id] = {
            usage: resource.total,
            co2: Math.round(co2 * 100) / 100,
            unit: 'kg CO2'
        };
        totalCO2 += co2;
    });

    // Convert to trees needed to offset (1 tree absorbs ~21 kg CO2/year)
    const treesNeeded = Math.ceil(totalCO2 / 21);

    return {
        totalCO2: Math.round(totalCO2 * 100) / 100,
        treesNeeded,
        breakdown,
        equivalent: {
            carTripsAvoided: Math.round((totalCO2 / 0.41) * 10) / 10, // kg CO2 per km car trip
            flightsAvoided: Math.round((totalCO2 / 200) * 10) / 10 // kg CO2 per flight hour
        }
    };
};

/**
 * Get conservation tips by resource type
 */
exports.getConservationTips = async (resourceType = null) => {
    const tips = {
        'Water': [
            {
                title: 'Install Aerators',
                description: 'Reduce water flow by 25-50% without affecting pressure',
                savings: '25-50%',
                cost: 'Low',
                difficulty: 'Easy'
            },
            {
                title: 'Fix Leaks Promptly',
                description: 'A single dripping faucet wastes 3,000 gallons annually',
                savings: '15-30%',
                cost: 'Low',
                difficulty: 'Easy'
            },
            {
                title: 'Shorter Showers',
                description: 'Reduce shower time by 2 minutes saves 12.5 gallons per shower',
                savings: '10-15%',
                cost: 'Free',
                difficulty: 'Easy'
            },
            {
                title: 'Mulching',
                description: 'Mulch reduces landscape watering needs by 50%',
                savings: '30-50%',
                cost: 'Medium',
                difficulty: 'Medium'
            },
            {
                title: 'Water-Efficient Toilet',
                description: 'Modern toilets use 1.28 gallons per flush vs 7+ in old models',
                savings: '20-30%',
                cost: 'High',
                difficulty: 'Professional'
            }
        ],
        'Electricity': [
            {
                title: 'LED Lighting',
                description: 'Use 75% less energy than incandescent bulbs',
                savings: '75%',
                cost: 'Low',
                difficulty: 'Easy'
            },
            {
                title: 'Smart Thermostat',
                description: 'Automated temperature management saves 10-23% on heating/cooling',
                savings: '10-23%',
                cost: 'Medium',
                difficulty: 'Medium'
            },
            {
                title: 'Unplug Devices',
                description: 'Phantom power drains 5-10% of residential electricity',
                savings: '5-10%',
                cost: 'Free',
                difficulty: 'Easy'
            },
            {
                title: 'Energy Efficient Appliances',
                description: 'ENERGY STAR appliances use 25-50% less energy',
                savings: '25-50%',
                cost: 'High',
                difficulty: 'Professional'
            },
            {
                title: 'Natural Lighting',
                description: 'Maximize daylight to reduce artificial lighting needs',
                savings: '15-25%',
                cost: 'Free',
                difficulty: 'Easy'
            }
        ],
        'LPG': [
            {
                title: 'Pressure Cooker',
                description: 'Reduces cooking time and gas usage by 33%',
                savings: '33%',
                cost: 'Low',
                difficulty: 'Easy'
            },
            {
                title: 'Lid While Cooking',
                description: 'Using lids reduces cooking time by up to 30%',
                savings: '30%',
                cost: 'Free',
                difficulty: 'Easy'
            },
            {
                title: 'Regular Maintenance',
                description: 'Clean stove burners ensure efficient gas combustion',
                savings: '10-15%',
                cost: 'Free',
                difficulty: 'Easy'
            }
        ],
        'Waste': [
            {
                title: 'Separate Recyclables',
                description: 'Reduce landfill waste by 40-50%',
                savings: '40-50%',
                cost: 'Free',
                difficulty: 'Easy'
            },
            {
                title: 'Composting',
                description: 'Compost 25-30% of household waste',
                savings: '25-30%',
                cost: 'Low',
                difficulty: 'Medium'
            },
            {
                title: 'Reduce Packaging',
                description: 'Buy in bulk and reduce single-use packaging',
                savings: '20-30%',
                cost: 'Free',
                difficulty: 'Easy'
            }
        ]
    };

    if (resourceType) {
        return tips[resourceType] || [];
    }

    return tips;
};

/**
 * Get energy efficiency score (0-100)
 */
exports.getEfficiencyScore = async (options = {}) => {
    const { blockId, startDate, endDate } = options;

    const matchStage = {
        deleted: { $ne: true }
    };

    if (blockId) {
        matchStage.blockId = new mongoose.Types.ObjectId(blockId.toString());
    }

    if (startDate || endDate) {
        matchStage.usage_date = {};
        if (startDate) matchStage.usage_date.$gte = new Date(startDate);
        if (endDate) matchStage.usage_date.$lte = new Date(endDate);
    }

    const usageStats = await Usage.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: '$resource_type',
                total: { $sum: '$usage_value' },
                avgValue: { $avg: '$usage_value' }
            }
        }
    ]);

    const configs = await ResourceConfig.find({ isActive: { $ne: false } }).lean();
    const configMap = {};
    configs.forEach(c => configMap[c.name] = c);

    let score = 100;
    const factors = [];

    usageStats.forEach(stat => {
        const config = configMap[stat._id];
        if (!config) return;

        const percentageOfLimit = (stat.total / (config.monthlyLimit || 1000)) * 100;
        
        if (percentageOfLimit > 150) {
            score -= 20;
            factors.push({ resource: stat._id, impact: 'Very High Usage', penalty: -20 });
        } else if (percentageOfLimit > 100) {
            score -= 10;
            factors.push({ resource: stat._id, impact: 'High Usage', penalty: -10 });
        } else if (percentageOfLimit < 50) {
            score += 5;
            factors.push({ resource: stat._id, impact: 'Low Usage', bonus: +5 });
        }
    });

    return {
        score: Math.max(0, Math.min(100, score)),
        factors,
        grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D',
        message: score >= 80 ? 'Excellent efficiency!' : score >= 60 ? 'Good work, optimize further' : 'Significant improvements needed'
    };
};

module.exports = exports;
