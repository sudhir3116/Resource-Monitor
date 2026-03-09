const cron = require('node-cron');
const Complaint = require('../models/Complaint');
const notification = require('../utils/notificationHelper');
const AuditLog = require('../models/AuditLog');

/**
 * Check for complaint SLA breaches every hour
 * Creates notifications for overdue complaints
 */
function startComplaintSLACheckJob() {
  // Run every hour at minute 0
  cron.schedule('0 * * * *', async () => {
    try {
      console.log('[Cron] Checking complaint SLA breaches...');

      const now = new Date();

      // Find all unresolved complaints where expected resolution date has passed
      const overdueComplaints = await Complaint.find({
        status: { $ne: 'resolved' },
        expectedResolutionDate: { $lt: now }
      }).populate('user', 'email name').populate('assignedTo', 'email name');

      if (overdueComplaints.length === 0) {
        console.log('[Cron] No overdue complaints found.');
        return;
      }

      console.log(`[Cron] Found ${overdueComplaints.length} overdue complaints.`);

      // Process each overdue complaint
      for (const complaint of overdueComplaints) {
        // Check if we already created a notification today
        const existingNotif = await notification.Notification.findOne({
          complaint: complaint._id,
          createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } // Last 24h
        });

        if (!existingNotif) {
          // Create notification for admin and assigned staff
          const recipients = [complaint.assignedTo].filter(Boolean);

          for (const recipient of recipients) {
            if (recipient && recipient.email) {
              try {
                await notification.createNotification({
                  recipientId: recipient._id,
                  type: 'sla_breach',
                  title: 'Complaint SLA Breached',
                  message: `Complaint #${complaint._id} from ${complaint.user?.name} is overdue`,
                  relatedResource: {
                    resourceType: 'Complaint',
                    resourceId: complaint._id
                  },
                  actionUrl: `/complaints/${complaint._id}`,
                  priority: 'high'
                });
              } catch (e) {
                console.error('Error creating notification:', e);
              }
            }
          }

          // Create audit log
          try {
            await AuditLog.create({
              action: 'COMPLAINT_SLA_BREACH',
              resourceType: 'Complaint',
              resourceId: complaint._id,
              description: `Complaint SLA breached - due date: ${complaint.expectedResolutionDate}`,
              changes: {
                status: complaint.status,
                daysOverdue: Math.floor((now - complaint.expectedResolutionDate) / (1000 * 60 * 60 * 24))
              }
            });
          } catch (e) {
            console.error('Error creating audit log:', e);
          }
        }
      }

      console.log(`[Cron] Processed ${overdueComplaints.length} complaints.`);
    } catch (err) {
      console.error('[Cron] Error in complaint SLA check:', err);
    }
  });
}

module.exports = startComplaintSLACheckJob;
