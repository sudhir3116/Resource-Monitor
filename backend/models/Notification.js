const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: ['ALERT_NEW', 'ALERT_UPDATED', 'COMPLAINT_UPDATE', 'SYSTEM'],
        required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    link: { type: String },
    relatedId: { type: mongoose.Schema.Types.ObjectId },
    createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
