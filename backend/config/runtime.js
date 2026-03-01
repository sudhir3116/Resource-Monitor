const crypto = require('crypto');

// Generate a unique instance ID every time the server starts.
// In PRODUCTION: Random ID on each restart (forces re-login for security)
// In DEVELOPMENT: Also using random ID to flush old sticky cookies for testing
const SERVER_INSTANCE_ID = crypto.randomBytes(16).toString('hex');

if (process.env.NODE_ENV !== 'production') {
	console.log(`🔐 Server Instance ID: ${SERVER_INSTANCE_ID}`);
} else {
	// Production: do not reveal instance ID in logs
	console.log('🔐 Server Instance ID: [REDACTED]');
}

module.exports = { SERVER_INSTANCE_ID };
