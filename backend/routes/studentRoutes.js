const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');
const asyncHandler = require('../middleware/asyncHandler');
const { getStudentUsageAnalytics } = require('../controllers/analyticsController');

/**
 * @desc    Get student's block usage analytics
 * @route   GET /api/students/usage-analytics
 * @access  Private (Student)
 */
router.get('/usage-analytics', auth, getStudentUsageAnalytics);

/**
 * @desc    Get current student's hostel and warden info
 * @route   GET /api/students/me
 * @access  Private (Student)
 */
router.get('/me', auth, asyncHandler(async (req, res) => {
    const student = await User.findById(req.user.id)
        .populate({
            path: 'block',
            populate: { path: 'warden', select: 'name email' }
        });

    if (!student) {
        return res.status(404).json({
            success: false,
            message: 'Student not found'
        });
    }

    res.json({
        success: true,
        data: {
            studentName: student.name,
            block: student.block ? student.block.name : 'Not Assigned',
            roomNumber: student.room || 'N/A',
            floor: student.floor || 'N/A',
            wardenName: student.block?.warden ? student.block.warden.name : 'N/A',
            wardenEmail: student.block?.warden ? student.block.warden.email : 'N/A'
        }
    });
}));

module.exports = router;
