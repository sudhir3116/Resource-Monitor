const Usage = require('../models/Usage');
const Alert = require('../models/Alert');
const Block = require('../models/Block');

const generateDailyReportData = async () => {
    const today = new Date();
    const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999);

    // 1. Resource Usage (Global)
    const resourceUsage = await Usage.aggregate([
        { $match: { usage_date: { $gte: startOfDay, $lte: endOfDay } } },
        { $group: { _id: '$resource_type', total: { $sum: '$usage_value' }, count: { $sum: 1 } } }
    ]);

    // 2. Block-wise Usage
    const blockUsage = await Usage.aggregate([
        { $match: { usage_date: { $gte: startOfDay, $lte: endOfDay }, blockId: { $ne: null } } },
        { $group: { _id: { block: '$blockId', resource: '$resource_type' }, total: { $sum: '$usage_value' } } }
    ]);

    // Resolve Block Names
    const blockStats = [];
    if (blockUsage.length > 0) {
        await Block.populate(blockUsage, { path: '_id.block', select: 'name' });
        // Transform for easier viewing
        blockUsage.forEach(item => {
            if (item._id.block) {
                blockStats.push({
                    block: item._id.block.name,
                    resource: item._id.resource,
                    total: item.total
                });
            }
        });
    }

    // 3. Alerts (New System)
    const alerts = await Alert.find({
        createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).populate('user', 'name email').populate('block', 'name');

    // 4. Score Logic (Simple deduction)
    let score = 100 - (alerts.filter(a => a.severity === 'critical' || a.severity === 'high').length * 10);
    if (score < 0) score = 0;

    return {
        date: startOfDay.toDateString(),
        resourceUsage,
        blockStats,
        alerts,
        score
    };
};

const formatReportHtml = (data) => {
    const { date, resourceUsage, blockStats, alerts, score } = data;

    const resourceTableRows = resourceUsage.map(r => `
        <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${r._id}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${r.total ? r.total.toFixed(2) : r.totalUsage ? r.totalUsage.toFixed(2) : 0}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${r.count}</td>
        </tr>
    `).join('');

    const blockRows = blockStats && blockStats.length > 0 ? blockStats.map(b => `
        <tr>
             <td style="padding: 8px; border: 1px solid #ddd;">${b.block}</td>
             <td style="padding: 8px; border: 1px solid #ddd;">${b.resource}</td>
             <td style="padding: 8px; border: 1px solid #ddd;">${b.total.toFixed(2)}</td>
        </tr>
    `).join('') : '<tr><td colspan="3" style="text-align:center; padding:8px;">No block data available</td></tr>';

    const alertItems = alerts.map(a => `
        <li style="margin-bottom: 5px; color: ${a.severity === 'critical' ? 'red' : a.severity === 'high' ? 'orange' : 'black'}">
            <strong>${a.resourceType}</strong>: ${a.message} 
            ${a.user ? `(User: ${a.user.name})` : ''} 
            ${a.block ? `(Block: ${a.block.name})` : ''}
        </li>
    `).join('');

    return `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #2c3e50; color: #fff; padding: 20px; text-align: center;">
                <h2 style="margin: 0;">Daily Sustainability Report</h2>
                <p style="margin: 5px 0 0;">${date}</p>
            </div>
            
            <div style="padding: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="display: inline-block; padding: 15px 25px; background-color: ${score > 80 ? '#27ae60' : score > 50 ? '#f39c12' : '#c0392b'}; color: #fff; border-radius: 50px; font-size: 24px; font-weight: bold;">
                        Score: ${score}/100
                    </div>
                </div>

                <h3 style="border-bottom: 2px solid #2c3e50; padding-bottom: 5px;">Overall Usage</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f8f9fa;">
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Resource</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Total Consumption</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Entries</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${resourceTableRows.length > 0 ? resourceTableRows : '<tr><td colspan="3" style="padding: 8px; text-align: center;">No usage recorded today.</td></tr>'}
                    </tbody>
                </table>
                
                ${blockStats && blockStats.length > 0 ? `
                <h3 style="border-bottom: 2px solid #2c3e50; padding-bottom: 5px;">Block Consumption</h3>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f8f9fa;">
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Block</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Resource</th>
                            <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${blockRows}
                    </tbody>
                </table>
                ` : ''}

                <h3 style="border-bottom: 2px solid #2c3e50; padding-bottom: 5px;">Alerts Triggered (${alerts.length})</h3>
                ${alerts.length > 0 ? `<ul>${alertItems}</ul>` : '<p>No alerts triggered today. Great job!</p>'}
            </div>
            
            <div style="background-color: #ecf0f1; padding: 15px; text-align: center; font-size: 12px; color: #7f8c8d;">
                <p>Sustainable Resource Monitor System</p>
                <p>This is an automated message. Please do not reply.</p>
            </div>
        </div>
    `;
};

module.exports = { generateDailyReportData, formatReportHtml };
