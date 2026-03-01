/**
 * config/constants.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized constants for the Sustainable Resource Monitor platform.
 * Import from here instead of duplicating literals across controllers/services.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Resource types (must match Usage.resource_type enum) ─────────────────────
const RESOURCE_TYPES = Object.freeze({
    ELECTRICITY: 'Electricity',
    WATER: 'Water',
    LPG: 'LPG',
    DIESEL: 'Diesel',
    FOOD: 'Food',
    WASTE: 'Waste',
});

// ── Units per resource ────────────────────────────────────────────────────────
const RESOURCE_UNITS = Object.freeze({
    Electricity: 'kWh',
    Water: 'Litres',
    LPG: 'kg',
    Diesel: 'Litres',
    Food: 'kg',
    Waste: 'kg',
});

// ── Alert severity bands ──────────────────────────────────────────────────────
// percentage = (totalUsage / limit) × 100
const SEVERITY_BANDS = Object.freeze([
    { min: 500, label: 'Severe' },
    { min: 200, label: 'Critical' },
    { min: 120, label: 'High' },
    { min: 100, label: 'Warning' },
]);

// Convert bands to a quick lookup function
function classifySeverity(percentage) {
    for (const band of SEVERITY_BANDS) {
        if (percentage >= band.min) return band.label;
    }
    return null; // below 100% → no alert
}

// ── Alert severity ordering (for de-dupe escalation) ─────────────────────────
const SEVERITY_LEVELS = Object.freeze({
    Warning: 1,
    High: 2,
    Critical: 3,
    Severe: 4,
});

// ── Alert statuses ────────────────────────────────────────────────────────────
const ALERT_STATUS = Object.freeze({
    ACTIVE: 'Active',
    PENDING: 'Active',    // alias kept for backward compat
    INVESTIGATING: 'Investigating',
    REVIEWED: 'Reviewed',
    ESCALATED: 'Escalated',
    RESOLVED: 'Resolved',
    DISMISSED: 'Dismissed',
});

// ── Alert types ───────────────────────────────────────────────────────────────
const ALERT_TYPES = Object.freeze({
    DAILY: 'daily',
    MONTHLY: 'monthly',
    SPIKE: 'spike',
    BUDGET: 'budget',
    MANUAL: 'manual',
});

// ── Escalation windows ────────────────────────────────────────────────────────
// How many hours must pass before escalating to the next level
const ESCALATION_WINDOWS = Object.freeze({
    TO_WARDEN: 2,    // Active → escalate to Warden after 2 h
    TO_DEAN: 6,    // Still Active → escalate to Dean after 6 h
    TO_PRINCIPAL: 24,   // Still Active → escalate to Principal after 24 h
});

// Escalation level → role label
const ESCALATION_ROLES = Object.freeze({
    1: 'warden',
    2: 'dean',
    3: 'principal',
});

// ── Date utilities ────────────────────────────────────────────────────────────
const DATE_FORMAT = 'YYYY-MM-DD'; // Standard ISO date format used in API responses

/** Returns { start, end } for today (midnight → 23:59:59.999) */
function todayRange() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return { start, end };
}

/** Returns { start, end } for current calendar month */
function currentMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
}

/** Returns a startDate N days ago (time set to 00:00:00) */
function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d;
}

// ── Pagination ────────────────────────────────────────────────────────────────
const PAGINATION = Object.freeze({
    DEFAULT_LIMIT: 50,
    MAX_LIMIT: 200,
});

// ── API response helpers ──────────────────────────────────────────────────────
const apiSuccess = (res, data = {}, statusCode = 200) =>
    res.status(statusCode).json({ success: true, ...data });

const apiError = (res, message = 'Server error', statusCode = 500) =>
    res.status(statusCode).json({ success: false, message });

module.exports = {
    RESOURCE_TYPES,
    RESOURCE_UNITS,
    SEVERITY_BANDS,
    SEVERITY_LEVELS,
    ALERT_STATUS,
    ALERT_TYPES,
    ESCALATION_WINDOWS,
    ESCALATION_ROLES,
    DATE_FORMAT,
    PAGINATION,
    classifySeverity,
    todayRange,
    currentMonthRange,
    daysAgo,
    apiSuccess,
    apiError,
};
