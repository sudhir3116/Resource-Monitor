const Notification = require('../models/Notification');
const socketManager = require('../socket/socketManager');

const createNotification = async (userId, type, title, message, link, relatedId) => {
    try {
        const notification = new Notification({
            userId,
            type,
            title,
            message,
            link,
            relatedId
        });
        await notification.save();

        const io = require('../utils/socket').getIO();
        if (io) {
            socketManager.emitToUser(io, userId, 'notification:new', notification);
        }
    } catch (err) {
        console.error('Error creating notification:', err);
    }
};

module.exports = {
    createNotification
};
