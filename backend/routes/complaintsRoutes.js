const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { ROLES } = require('../config/roles');
const { body, param } = require('express-validator');
const runValidations = require('../middleware/validate');
const { auditMiddleware } = require('../utils/auditLogger');
const {
    getComplaints,
    createComplaint,
    reviewComplaint,
    resolveComplaint,
    escalateComplaint,
    updateComplaintStatus,
    getComplaintStatistics
} = require('../controllers/complaintsController');

// All routes require authentication
router.use(authMiddleware);

// ── All authenticated users can list and submit ────────────────────────────
router.get('/', getComplaints);
router.post('/', [body('title').notEmpty().withMessage('title is required'), body('description').notEmpty().withMessage('description is required')], runValidations, auditMiddleware('CREATE', 'Complaint'), createComplaint);

// ── Stats: Admin, Warden, Dean, Principal ─────────────────────────────────
router.get('/stats',
    authorizeRoles(ROLES.ADMIN, ROLES.WARDEN, ROLES.GM, ROLES.DEAN, ROLES.PRINCIPAL),
    getComplaintStatistics
);

// ── Review: Admin and Warden only ─────────────────────────────────────────
router.put('/:id/review',
    authorizeRoles(ROLES.ADMIN, ROLES.WARDEN),
    [param('id').isMongoId().withMessage('Invalid id')],
    runValidations,
    auditMiddleware('UPDATE', 'Complaint'),
    reviewComplaint
);

// ── Resolve: Admin and Warden only ────────────────────────────────────────
router.put('/:id/resolve',
    authorizeRoles(ROLES.ADMIN, ROLES.WARDEN),
    [param('id').isMongoId().withMessage('Invalid id')],
    runValidations,
    auditMiddleware('RESOLVE_COMPLAINT', 'Complaint'),
    resolveComplaint
);

// ── Escalate: Admin, GM only ──────────────────────────────────────────────
router.put('/:id/escalate',
    authorizeRoles(ROLES.ADMIN, ROLES.GM),
    [param('id').isMongoId().withMessage('Invalid id')],
    runValidations,
    auditMiddleware('ESCALATE_COMPLAINT', 'Complaint'),
    escalateComplaint
);

// ── Generic status update: Admin, Warden, GM ──────────────────────────────
router.put('/:id/status',
    authorizeRoles(ROLES.ADMIN, ROLES.WARDEN, ROLES.GM),
    [param('id').isMongoId().withMessage('Invalid id')],
    runValidations,
    auditMiddleware('UPDATE', 'Complaint'),
    updateComplaintStatus
);

// ── PATCH status update (alternative endpoint) ──────────────────────────────
router.patch('/:id/status',
    authorizeRoles(ROLES.ADMIN, ROLES.WARDEN, ROLES.GM),
    [param('id').isMongoId().withMessage('Invalid id')],
    runValidations,
    auditMiddleware('UPDATE', 'Complaint'),
    updateComplaintStatus
);

module.exports = router;
