const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { rateLimit } = require('express-rate-limit');
const verifyToken = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { createAuditLog } = require('../utils/auditLogger'); // using existing logger

// Rate limit: 30 requests per minute
const dbViewerLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: { success: false, message: 'Too many requests to Database Viewer, please try again later.' },
    handler: (req, res, next, options) => {
        res.status(options.statusCode).send(options.message);
    }
});

// Helper for logging
const logAudit = async (req, description) => {
    try {
        await createAuditLog({
            action: 'DB_VIEWER_ACCESS',
            resourceType: 'Database',
            userId: req.user.id || req.user._id,
            description,
            req
        });
    } catch (err) {
        console.error('Audit Log failed', err);
    }
};

// Sanitize collection name
const sanitizeCollectionName = (name) => {
    return name.replace(/[^a-zA-Z0-9_]/g, '');
};

// Apply middlewares to all routes
router.use(verifyToken);
router.use(authorizeRoles('admin'));
router.use(dbViewerLimiter);

// 1. Get all collections with document counts
router.get('/collections', async (req, res) => {
    try {
        await logAudit(req, 'Opened Database Viewer');

        const db = mongoose.connection.db;
        const collectionsList = await db.listCollections().toArray();

        const result = [];
        for (const col of collectionsList) {
            const count = await db.collection(col.name).estimatedDocumentCount();
            result.push({ name: col.name, count });
        }

        res.status(200).json({ collections: result });
    } catch (err) {
        console.error('Fetch collections error', err);
        res.status(500).json({ success: false, message: 'Failed to fetch database collections' });
    }
});

// 2. Get Overall Database stats + collections stats
router.get('/stats', async (req, res) => {
    try {
        const db = mongoose.connection.db;
        const dbStats = await db.command({ dbStats: 1 });

        const collectionsList = await db.listCollections().toArray();
        const colStatsPromises = collectionsList.map(async (col) => {
            const stats = await db.command({ collStats: col.name });
            return {
                name: col.name,
                count: stats.count,
                avgDocumentSize: stats.avgObjSize ? (stats.avgObjSize / 1024).toFixed(2) + ' KB' : '0 KB',
                lastInserted: '-' // Difficult to get last inserted universally O(1) without createdAt, can fall back to general DB stat or omit.
            };
        });

        const colStats = await Promise.all(colStatsPromises);

        res.status(200).json({
            totalCollections: collectionsList.length,
            totalDocuments: dbStats.objects,
            databaseName: db.databaseName,
            collections: colStats
        });
    } catch (err) {
        console.error('Fetch DB stats error', err);
        res.status(500).json({ success: false, message: 'Failed to fetch database statistics' });
    }
});

// 3. Get single document by ID
router.get('/collections/:collectionName/:documentId', async (req, res) => {
    try {
        const collectionName = sanitizeCollectionName(req.params.collectionName);
        const { documentId } = req.params;

        await logAudit(req, `Viewed document in ${collectionName}`);

        const db = mongoose.connection.db;

        let queryId;
        try {
            queryId = new mongoose.Types.ObjectId(documentId);
        } catch (e) {
            queryId = documentId; // In case it's not a valid ObjectId format
        }

        const doc = await db.collection(collectionName).findOne({ _id: queryId }, { projection: { password: 0 } });

        if (!doc) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        res.status(200).json(doc);
    } catch (err) {
        console.error('Fetch document error', err);
        res.status(500).json({ success: false, message: 'Failed to fetch document' });
    }
});

// 4. Get paginated documents from a collection
router.get('/collections/:collectionName', async (req, res) => {
    try {
        const collectionName = sanitizeCollectionName(req.params.collectionName);

        await logAudit(req, `Viewed collection: ${collectionName}`);

        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;

        const { search, sortBy, order, startDate, endDate } = req.query;

        const db = mongoose.connection.db;
        const col = db.collection(collectionName);

        // Build Query
        let query = {};
        if (search) {
            // Very basic text search simulation across all fields is complex in raw MongoDB without $text indices.
            // But we can do a broad regex across typical string fields if we know them, or just rely on a simple text index if it exists.
            // As a general fallback, searching name, email, title, etc. based on typical keys.
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { status: { $regex: search, $options: 'i' } }
            ];
            // If the collection doesn't have these, $or still works, just returns empty. No breaking.
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Build Sort
        let sortObj = {};
        if (sortBy) {
            sortObj[sortBy] = order === 'asc' ? 1 : -1;
        } else {
            sortObj = { createdAt: -1, _id: -1 }; // fallback
        }

        // Always Exclude
        const projection = { password: 0, __v: 0 };

        const [docs, total] = await Promise.all([
            col.find(query).project(projection).sort(sortObj).skip(skip).limit(limit).toArray(),
            col.countDocuments(query)
        ]);

        // Determine fields based on the first document or schema
        let fields = ['_id'];
        if (docs.length > 0) {
            // Collect unique keys from all returned docs to ensure coverage in a schema-less setup
            const keySet = new Set();
            for (const d of docs) {
                Object.keys(d).forEach(k => keySet.add(k));
            }
            fields = Array.from(keySet);
        } else {
            // Backup generic fetch for fields if currently empty page
            const sample = await col.findOne();
            if (sample) fields = Object.keys(sample).filter(k => k !== 'password' && k !== '__v');
        }

        res.status(200).json({
            collection: collectionName,
            data: docs,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPrevPage: page > 1,
            fields
        });

    } catch (err) {
        console.error('Fetch collection data error', err);
        res.status(500).json({ success: false, message: 'Failed to fetch collection data' });
    }
});

module.exports = router;
