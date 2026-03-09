/**
 * utils/queryBuilder.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable query building utilities for filtering, sorting, and pagination.
 * Used across all list endpoints (Usage, Alerts, Users, Complaints, etc.)
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Parse and validate sort parameters from query string
 * Format: sort=field:asc,field2:desc
 * Default: createdAt:desc (newest first)
 * 
 * @param {string} sortParam - Raw sort string from query
 * @param {string[]} allowedFields - Which fields can be sorted
 * @returns {Object} MongoDB sort object {field: 1|-1}
 * @example
 *   parseSortParam('date:desc,resource:asc', ['date', 'resource', 'usage']) 
 *   => { usage_date: -1, resource_type: 1 }
 */
function parseSortParam(sortParam = '', allowedFields = []) {
  const sort = {};
  
  if (!sortParam) {
    // Default sort: most recent first
    return { createdAt: -1 };
  }

  const sortPairs = sortParam.split(',').map(s => s.trim());
  
  for (const pair of sortPairs) {
    const [field, direction] = pair.split(':').map(s => s.trim());
    
    // Case-insensitive field matching
    const normalizedField = normalizeFieldName(field);
    
    if (allowedFields.includes(normalizedField)) {
      const sortDir = direction?.toLowerCase() === 'asc' ? 1 : -1;
      sort[normalizedField] = sortDir;
    }
  }

  return Object.keys(sort).length > 0 ? sort : { createdAt: -1 };
}

/**
 * Normalize field names for database queries
 * Maps common names to actual schema field names
 * 
 * @param {string} field - Field name to normalize
 * @returns {string} Normalized field name
 */
function normalizeFieldName(field) {
  const fieldMap = {
    // Usage fields
    'date': 'usage_date',
    'resource': 'resource_type',
    'usage': 'usage_value',
    'block': 'blockId',
    'user': 'userId',
    'amount': 'usage_value',
    
    // Alert fields
    'severity': 'severity',
    'status': 'status',
    'type': 'alertType',
    'updated': 'updatedAt',
    'created': 'createdAt',
    
    // Generic fields
    'email': 'email',
    'name': 'name',
    'priority': 'priority',
    'category': 'category'
  };
  
  return fieldMap[field?.toLowerCase()] || field;
}

/**
 * Build date range filter from query parameters
 * Supports multiple formats:
 * - startDate=/endDate= (ISO dates)
 * - range=last7days|last30days|last90days|thisMonth|lastMonth|custom
 * 
 * @param {Object} queryParams - Express req.query object
 * @returns {Object} MongoDB date filter {$gte, $lte}
 */
function buildDateRangeFilter(queryParams) {
  const { startDate, endDate, dateField = 'createdAt', range } = queryParams;
  
  const dateFilter = {};
  let start = null;
  let end = null;

  // Handle preset ranges
  if (range) {
    const now = new Date();
    end = new Date();
    
    switch (range) {
      case 'last7days':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'last30days':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last90days':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = null;
    }
  }

  // Handle explicit start/end dates (override range)
  if (startDate) {
    start = new Date(startDate);
    if (isNaN(start.getTime())) start = null;
  }
  if (endDate) {
    end = new Date(endDate);
    // Set to end of day if just a date
    end.setHours(23, 59, 59, 999);
    if (isNaN(end.getTime())) end = null;
  }

  if (start) dateFilter.$gte = start;
  if (end) dateFilter.$lte = end;

  return Object.keys(dateFilter).length > 0 ? { [dateField]: dateFilter } : {};
}

/**
 * Build a comprehensive filter object from query parameters
 * Handles: date range, numeric ranges, enums, text search, block scope
 * 
 * @param {Object} queryParams - Express req.query {filters: JSON string}
 * @param {string} userRole - User's role for scoping
 * @param {ObjectId} userBlockId - User's assigned block (if any)
 * @returns {Object} MongoDB filter object
 * @example
 *   buildFilter(
 *     { filters: JSON.stringify({ resource: 'Electricity', severity: 'High' }) },
 *     'warden',
 *     blockId
 *   )
 *   => { resource_type: 'Electricity', severity: 'High', blockId: ObjectId(...) }
 */
function buildFilter(queryParams, userRole, userBlockId) {
  const filter = {};
  
  // Parse filters JSON if provided
  if (queryParams.filters) {
    try {
      const filterObj = typeof queryParams.filters === 'string' 
        ? JSON.parse(queryParams.filters)
        : queryParams.filters;
      Object.assign(filter, filterObj);
    } catch (e) {
      console.error('Invalid filters JSON:', e.message);
    }
  }

  // Apply date range filter if parameters exist
  const dateFilter = buildDateRangeFilter(queryParams);
  Object.assign(filter, dateFilter);

  // Scope to user's block if warden
  if (userRole === 'warden' && userBlockId) {
    filter.blockId = userBlockId;
  }

  // Exclude soft-deleted records by default
  if (!filter.hasOwnProperty('deleted')) {
    filter.deleted = { $ne: true };
  }

  return filter;
}

/**
 * Parse pagination parameters from query
 * Enforces sensible limits (max 500 records per page)
 * 
 * @param {Object} queryParams - Express req.query {page, limit}
 * @returns {Object} {skip, limit}
 */
function parsePagination(queryParams) {
  const page = Math.max(1, parseInt(queryParams.page || 1));
  const limit = Math.min(
    Math.max(1, parseInt(queryParams.limit || 50)),
    500 // Max 500 records per page
  );

  return {
    skip: (page - 1) * limit,
    limit,
    page
  };
}

/**
 * Build a complete query pipeline from all parameters
 * Used in complex aggregation pipelines
 * 
 * @param {Object} options - {filter, sort, skip, limit}
 * @returns {Array} Aggregation pipeline stages
 */
function buildAggregationPipeline(options = {}) {
  const { filter = {}, sort = {}, skip = 0, limit = 50, group = null } = options;
  const stages = [];

  if (Object.keys(filter).length > 0) {
    stages.push({ $match: filter });
  }

  if (group) {
    stages.push(group);
  }

  if (Object.keys(sort).length > 0) {
    stages.push({ $sort: sort });
  }

  if (skip > 0) {
    stages.push({ $skip: skip });
  }

  stages.push({ $limit: limit });

  return stages;
}

/**
 * Validate and sanitize sort fields to prevent injection
 * 
 * @param {string} sortStr - Comma-separated sort string
 * @param {string[]} allowedFields - Whitelist of allowed fields
 * @returns {string} Sanitized sort string or empty
 */
function sanitizeSortString(sortStr, allowedFields = []) {
  if (!sortStr || typeof sortStr !== 'string') return '';
  
  return sortStr
    .split(',')
    .map(s => s.trim())
    .filter(s => {
      const [field] = s.split(':');
      return allowedFields.includes(field);
    })
    .join(',');
}

module.exports = {
  parseSortParam,
  normalizeFieldName,
  buildDateRangeFilter,
  buildFilter,
  parsePagination,
  buildAggregationPipeline,
  sanitizeSortString
};
