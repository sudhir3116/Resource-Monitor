const cron = require('node-cron');
const reportService = require('../services/reportService');
const emailService = require('../utils/emailService');
const User = require('../models/User');
const { ROLES } = require('../config/roles');
require('dotenv').config();

const startDailyReportJob = () => {
    // Schedule task to run at 8:00 PM every day
    // Pattern: '0 20 * * *' (minute hour day-of-month month day-of-week)
    cron.schedule('0 20 * * *', async () => {
        if (process.env.NODE_ENV !== 'production') console.log('Running daily sustainability report job...');
        try {
            const data = await reportService.generateDailyReportData();
            const html = reportService.formatReportHtml(data);

            const recipientRoles = [ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.WARDEN];
            const recipients = await User.find({
                role: { $in: recipientRoles }
            }).select('email');

            const emails = recipients.map(u => u.email).filter(e => e);

                if (emails.length > 0) {
                    await emailService.sendReportEmail(emails, `Sustainability Report - ${data.date}`, html);
                    if (process.env.NODE_ENV !== 'production') console.log(`Daily report sent successfully to ${emails.length} recipients.`);
                } else {
                    if (process.env.NODE_ENV !== 'production') console.warn('No admin recipients found for daily report.');
                }
        } catch (error) {
            console.error('Error generating/sending daily report:', error);
        }
    });

    if (process.env.NODE_ENV !== 'production') console.log('Daily Report Cron Job scheduled for 20:00 daily.');
};

module.exports = startDailyReportJob;
