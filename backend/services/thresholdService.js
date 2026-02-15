const Alert = require('../models/Alert');
const Usage = require('../models/Usage');
const SystemConfig = require('../models/SystemConfig');
const User = require('../models/User');
const mongoose = require('mongoose');
const { sendAlertEmail } = require('../utils/emailService');

/**
 * Checks if usage exceeds daily and monthly limits and creates alerts
 * @param {string} userId - User ID who added usage
 * @param {string} resourceType - Type of resource
 * @param {Date} date - Date of usage (usually today)
 */
const checkThresholds = async (userId, resourceType, date) => {
    try {
        // Get config for resource
        const config = await SystemConfig.findOne({ resource: resourceType });
        if (!config || !config.alertsEnabled) return; // No limit set or alerts disabled

        // Check daily limits
        await checkDailyThresholds(userId, resourceType, date, config);

        // Check monthly limits
        await checkMonthlyThresholds(userId, resourceType, date, config);

        // Check spike detection
        await checkSpikeDetection(userId, resourceType, date, config);

    } catch (error) {
        console.error('Error checking thresholds:', error);
    }
};

/**
 * Check daily thresholds
 */
const checkDailyThresholds = async (userId, resourceType, date, config) => {
    try {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        // Get user to check block
        const user = await User.findById(userId);
        if (!user) return;

        // Calculate total usage for user today
        const usageAgg = await Usage.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    resource_type: resourceType,
                    usage_date: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$usage_value' }
                }
            }
        ]);

        const totalUsage = usageAgg.length > 0 ? usageAgg[0].total : 0;
        const limit = config.dailyLimitPerPerson;

        if (!limit) return;

        // Check against percentage thresholds
        let severity = null;
        let message = '';

        const percentage = (totalUsage / limit) * 100;

        if (percentage >= config.severityThreshold.critical) {
            severity = 'critical';
            message = `Critical: ${resourceType} daily usage (${totalUsage.toFixed(2)} ${config.unit}) exceeded ${config.severityThreshold.critical}% of daily limit (${limit} ${config.unit})`;
        } else if (percentage >= config.severityThreshold.high) {
            severity = 'high';
            message = `High: ${resourceType} daily usage (${totalUsage.toFixed(2)} ${config.unit}) reached ${config.severityThreshold.high}% of daily limit`;
        } else if (percentage >= config.severityThreshold.medium) {
            severity = 'medium';
            message = `Warning: ${resourceType} daily usage is high (${Math.round(percentage)}% of limit)`;
        }

        if (severity) {
            // Check if alert already exists for today with same or higher severity to avoid spam
            const existingAlert = await Alert.findOne({
                user: userId,
                resourceType,
                createdAt: { $gte: startOfDay, $lte: endOfDay },
                severity: { $in: ['medium', 'high', 'critical'] }
            });

            const severityLevels = { 'medium': 1, 'high': 2, 'critical': 3 };

            // Create alert only if no existing alert or severity increased
            if (!existingAlert || severityLevels[severity] > severityLevels[existingAlert.severity]) {
                await Alert.create({
                    user: userId,
                    block: user.block || null,
                    resourceType,
                    amount: totalUsage,
                    threshold: limit,
                    message,
                    severity,
                    status: 'active'
                });

                // Send Email Notification
                await sendAlertEmail(userId, `${severity.toUpperCase()} Alert: ${resourceType} Limit`, message);
            }
        }

    } catch (error) {
        console.error('Error checking daily thresholds:', error);
    }
};

/**
 * Check monthly thresholds
 */
const checkMonthlyThresholds = async (userId, resourceType, date, config) => {
    try {
        const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0);
        const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        endOfMonth.setHours(23, 59, 59, 999);

        const monthlyLimit = config.monthlyLimitPerPerson;
        if (!monthlyLimit) return;

        // Calculate total usage for user this month
        const usageAgg = await Usage.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    resource_type: resourceType,
                    usage_date: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$usage_value' }
                }
            }
        ]);

        const totalUsage = usageAgg.length > 0 ? usageAgg[0].total : 0;
        const percentage = (totalUsage / monthlyLimit) * 100;

        let severity = null;
        let message = '';

        if (percentage >= config.severityThreshold.critical) {
            severity = 'critical';
            message = `Critical: ${resourceType} monthly usage (${totalUsage.toFixed(2)} ${config.unit}) exceeded ${config.severityThreshold.critical}% of monthly limit (${monthlyLimit} ${config.unit})`;
        } else if (percentage >= config.severityThreshold.high) {
            severity = 'high';
            message = `High: ${resourceType} monthly usage (${totalUsage.toFixed(2)} ${config.unit}) reached ${config.severityThreshold.high}% of monthly limit`;
        } else if (percentage >= config.severityThreshold.medium) {
            severity = 'medium';
            message = `Warning: ${resourceType} monthly usage is high (${Math.round(percentage)}% of limit)`;
        }

        if (severity) {
            // Check if alert already exists for this month with same severity
            const existingAlert = await Alert.findOne({
                user: userId,
                resourceType,
                message: { $regex: 'monthly' },
                createdAt: { $gte: startOfMonth, $lte: endOfMonth },
                severity: { $in: ['medium', 'high', 'critical'] }
            });

            const severityLevels = { 'medium': 1, 'high': 2, 'critical': 3 };
            const user = await User.findById(userId);

            // Create alert only if no existing alert or severity increased
            if (!existingAlert || severityLevels[severity] > severityLevels[existingAlert.severity]) {
                await Alert.create({
                    user: userId,
                    block: user.block || null,
                    resourceType,
                    amount: totalUsage,
                    threshold: monthlyLimit,
                    message,
                    severity,
                    status: 'active'
                });

                // Send Email Notification
                await sendAlertEmail(userId, `${severity.toUpperCase()} Alert: ${resourceType} Monthly Limit`, message);
            }
        }

    } catch (error) {
        console.error('Error checking monthly thresholds:', error);
    }
};

/**
 * Check for abnormal spikes in usage
 */
const checkSpikeDetection = async (userId, resourceType, date, config) => {
    try {
        // Get last 5 records for this user and resource (for better average)
        const recentRecords = await Usage.find({
            userId,
            resource_type: resourceType,
            usage_date: { $lt: date }
        }).sort({ usage_date: -1 }).limit(5);

        if (recentRecords.length < 3) return; // Need at least 3 records for meaningful average

        // Calculate average of recent records
        const avgRecent = recentRecords.reduce((acc, curr) => acc + curr.usage_value, 0) / recentRecords.length;

        // Get today's latest entry
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const todayUsage = await Usage.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    resource_type: resourceType,
                    usage_date: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$usage_value' }
                }
            }
        ]);

        const totalToday = todayUsage.length > 0 ? todayUsage[0].total : 0;

        // Check if spike exceeds threshold
        const spikePercentage = ((totalToday - avgRecent) / avgRecent) * 100;

        if (spikePercentage >= config.spikeThreshold) {
            const message = `Abnormal Spike: ${resourceType} usage today (${totalToday.toFixed(2)} ${config.unit}) is ${Math.round(spikePercentage)}% higher than recent average (${avgRecent.toFixed(2)} ${config.unit})`;

            // Check if spike alert already exists for today
            const existingAlert = await Alert.findOne({
                user: userId,
                resourceType,
                message: { $regex: 'Abnormal Spike' },
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            });

            if (!existingAlert) {
                const user = await User.findById(userId);
                await Alert.create({
                    user: userId,
                    block: user.block || null,
                    resourceType,
                    amount: totalToday,
                    threshold: avgRecent,
                    message,
                    severity: 'high',
                    status: 'active'
                });

                // Send Email Notification
                await sendAlertEmail(userId, 'High Alert: Abnormal Usage Spike Detected', message);
            }
        }

    } catch (error) {
        console.error('Error checking spike detection:', error);
    }
};

module.exports = { checkThresholds };
