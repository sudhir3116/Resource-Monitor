const cron = require('node-cron');
const reportService = require('../services/reportService');
const emailService = require('../utils/emailService');
const User = require('../models/User');
const CronLog = require('../models/CronLog');
const { ROLES } = require('../config/roles');
require('dotenv').config();

const JOB_NAME = 'dailyReport';

const startDailyReportJob = () => {
    // Schedule task to run at 8:00 PM every day
    // Pattern: '0 20 * * *' (minute hour day-of-month month day-of-week)
    cron.schedule('0 20 * * *', async () => {
        if (process.env.NODE_ENV !== 'production') console.log('[DailyReport] Running daily sustainability report job...');
        const runAt = new Date();
        const startTime = Date.now();

        try {
            const data = await reportService.generateDailyReportData();
            const html = reportService.formatReportHtml(data);

            const recipientRoles = [ROLES.ADMIN, ROLES.DEAN, ROLES.WARDEN];
            const recipients = await User.find({
                role: { $in: recipientRoles }
            }).select('email');

            const emails = recipients.map(u => u.email).filter(e => e);

            if (emails.length > 0) {
                await emailService.sendReportEmail(emails, `Sustainability Report - ${data.date}`, html);
                if (process.env.NODE_ENV !== 'production') console.log(`[DailyReport] Sent successfully to ${emails.length} recipients.`);
            } else {
                if (process.env.NODE_ENV !== 'production') console.warn('[DailyReport] No admin recipients found.');
            }

            // Log success
            await CronLog.create({
                jobName: JOB_NAME,
                status: 'success',
                runAt,
                duration: Date.now() - startTime,
            });

        } catch (error) {
            console.error('[DailyReport] Cron error:', error.message);
            // Log failure — do NOT crash the server
            try {
                await CronLog.create({
                    jobName: JOB_NAME,
                    status: 'failed',
                    runAt,
                    duration: Date.now() - startTime,
                    error: error.message,
                });
            } catch (logErr) {
                console.error('[DailyReport] Failed to write CronLog:', logErr.message);
            }
        }
    });

    if (process.env.NODE_ENV !== 'production') console.log('Daily Report Cron Job scheduled for 20:00 daily.');
};

module.exports = startDailyReportJob;
