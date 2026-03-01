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

module.exports = { sendAlertEmail, sendReportEmail };
