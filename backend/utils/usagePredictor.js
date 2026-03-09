const Usage = require('../models/Usage');
const SystemConfig = require('../models/SystemConfig');
const mongoose = require('mongoose');

/**
 * Predict end-of-month usage based on current trend
 * @param {Array} usageRecords - Array of usage records for current month
 * @param {Number} limit - Monthly limit for this resource
 * @param {Date} currentDate - Current date
 * @returns {Object} Prediction data
 */
async function predictEndOfMonth(usageRecords, limit, currentDate = new Date()) {
  try {
    if (!usageRecords || usageRecords.length === 0) {
      return {
        currentUsage: 0,
        projectedTotal: 0,
        projectedPercent: 0,
        daysLeft: getDaysLeftInMonth(currentDate),
        willExceed: false,
        exceedByAmount: 0,
        exceedByDate: null,
        confidence: 'low'
      };
    }

    // Calculate total current usage
    const currentUsage = usageRecords.reduce((sum, r) => sum + r.usage_value, 0);

    // Calculate average daily usage from records
    const daysSoFar = new Set(usageRecords.map(r => 
      new Date(r.usage_date).toISOString().split('T')[0]
    )).size;

    const avgDailyUsage = daysSoFar > 0 ? currentUsage / daysSoFar : 0;

    // Get days left in month
    const daysLeft = getDaysLeftInMonth(currentDate);

    // Project total usage
    const projectedTotal = currentUsage + (avgDailyUsage * daysLeft);
    const projectedPercent = limit > 0 ? (projectedTotal / limit * 100) : 0;

    // Calculate when limit will be exceeded
    let exceedByDate = null;
    let exceedByAmount = Math.max(0, projectedTotal - limit);

    if (projectedTotal > limit && avgDailyUsage > 0) {
      const usageNeededToExceed = limit - currentUsage;
      const daysUntilExceed = usageNeededToExceed / avgDailyUsage;
      exceedByDate = new Date(currentDate.getTime() + daysUntilExceed * 24 * 60 * 60 * 1000);
    }

    return {
      currentUsage: Math.round(currentUsage * 100) / 100,
      averageDailyUsage: Math.round(avgDailyUsage * 100) / 100,
      projectedTotal: Math.round(projectedTotal * 100) / 100,
      projectedPercent: Math.round(projectedPercent * 100) / 100,
      daysLeft,
      daysSoFar,
      willExceed: projectedTotal > limit,
      exceedByAmount: Math.round(exceedByAmount * 100) / 100,
      exceedByDate: exceedByDate ? exceedByDate.toISOString().split('T')[0] : null,
      confidence: daysSoFar >= 10 ? 'high' : daysSoFar >= 5 ? 'medium' : 'low'
    };
  } catch (err) {
    console.error('Error in predictEndOfMonth:', err);
    return {
      error: 'Prediction calculation failed',
      currentUsage: 0,
      projectedTotal: 0,
      willExceed: false
    };
  }
}

/**
 * Calculate remaining days in the current month
 */
function getDaysLeftInMonth(date = new Date()) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return lastDay - date.getDate();
}

module.exports = {
  predictEndOfMonth,
  getDaysLeftInMonth
};
