const mailer = require('../utils/mailer');
const User = require('../models/User');

/**
 * Send an alert email to a user
 * @param {string} userId - ID of the user to email
 * @param {string} subject - Email subject
 * @param {string} message - Email body text
 */
const sendAlertEmail = async (userId, subject, message) => {
    try {
        if (process.env.DISABLE_EMAILS === 'true') return;
        const user = await User.findById(userId).select('email name');
        if (user && user.email) {
            const text = `Hello ${user.name || 'User'},\n\n${message}\n\nLogin to your dashboard for more details.\n\nBest regards,\nSustainable Resource Monitor Team`;
            await mailer.sendMail({
                to: user.email,
                subject: `[Alert] ${subject}`,
                text
            });
            if (process.env.NODE_ENV !== 'production') console.log(`Alert email sent to ${user.email}`);
        }
    } catch (error) {
        console.error('Error sending alert email:', error);
    }
};

/**
 * Send a daily report email to multiple recipients
 * @param {Array<string>} emails - List of email addresses
 * @param {string} subject - Report subject
 * @param {string} htmlContent - Report HTML content
 */
const sendReportEmail = async (emails, subject, htmlContent) => {
    try {
        if (process.env.DISABLE_EMAILS === 'true') return;
        if (!emails || emails.length === 0) return;

        await mailer.sendMail({
            to: emails.join(','),
            subject: `[Daily Report] ${subject}`,
            html: htmlContent
        });
        if (process.env.NODE_ENV !== 'production') console.log(`Daily report sent to ${emails.length} recipients`);
    } catch (error) {
        console.error('Error sending report email:', error);
    }
};

const sendCriticalAlertEmail = async (recipients, alertData) => {
    try {
        if (process.env.DISABLE_EMAILS === 'true') return;
        if (!process.env.EMAIL_HOST || !recipients || recipients.length === 0) {
            console.log('[EmailService] Email skipped: no configuration or empty recipients.');
            return;
        }

        const subject = `🚨 CRITICAL Alert — ${alertData.block} ${alertData.resource} Exceeded`;
        const htmlContent = `
            <h2>EcoMonitor Critical Alert</h2>
            <p>A critical resource limit has been exceeded.</p>
            <table border="1" cellpadding="10" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 600px;">
                <tr>
                    <td style="background-color: #f1f5f9; font-weight: bold;">Block</td>
                    <td>${alertData.block}</td>
                </tr>
                <tr>
                    <td style="background-color: #f1f5f9; font-weight: bold;">Resource</td>
                    <td>${alertData.resource}</td>
                </tr>
                <tr>
                    <td style="background-color: #f1f5f9; font-weight: bold;">Usage Value</td>
                    <td style="color: #dc2626; font-weight: bold;">${alertData.value}</td>
                </tr>
                <tr>
                    <td style="background-color: #f1f5f9; font-weight: bold;">Limit</td>
                    <td>${alertData.limit}</td>
                </tr>
                <tr>
                    <td style="background-color: #f1f5f9; font-weight: bold;">Severity</td>
                    <td style="color: #dc2626; font-weight: bold;">CRITICAL</td>
                </tr>
            </table>
            <p>Please investigate this alert in the EcoMonitor dashboard immediately.</p>
        `;

        await mailer.sendMail({
            to: recipients.join(', '),
            subject,
            html: htmlContent
        });

        console.log(`[EmailService] Critical alert email sent to ${recipients.length} recipients`);
    } catch (error) {
        console.error('[EmailService] Failed to send email:', error.message);
    }
};

module.exports = { sendAlertEmail, sendReportEmail, sendCriticalAlertEmail };
