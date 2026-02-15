const crypto = require('crypto');

// Generate a unique instance ID every time the server starts.
// This invalidates existing tokens effectively if they are bound to instanceId,
// enforcing a re-login on server restart as requested.
const SERVER_INSTANCE_ID = crypto.randomBytes(16).toString('hex');

module.exports = { SERVER_INSTANCE_ID };
