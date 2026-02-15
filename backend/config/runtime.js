const crypto = require('crypto');

// Generate a unique instance ID every time the server starts.
// In PRODUCTION: Random ID on each restart (forces re-login for security)
// In DEVELOPMENT: Fixed ID (prevents constant logouts during dev server restarts)
const SERVER_INSTANCE_ID = process.env.NODE_ENV === 'production'
    ? crypto.randomBytes(16).toString('hex')
    : 'dev-fixed-instance-id';

console.log(`🔐 Server Instance ID: ${process.env.NODE_ENV === 'production' ? '[RANDOM]' : SERVER_INSTANCE_ID}`);

module.exports = { SERVER_INSTANCE_ID };
