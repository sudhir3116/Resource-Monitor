const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', async (req, res) => {
    try {
        const query = { userId: req.user.id };
        const notifications = await Notification.find(query).sort({ createdAt: -1 }).limit(50);
        const unreadCount = await Notification.countDocuments({ ...query, read: false });

        res.status(200).json({ notifications, unreadCount });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/:id/read', async (req, res) => {
    try {
        await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { read: true }
        );
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.put('/read-all', async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user.id, read: false },
            { read: true }
        );
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
