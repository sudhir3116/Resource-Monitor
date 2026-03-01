const errorHandler = (err, req, res, next) => {
    // Only log full stack in development
    if (process.env.NODE_ENV !== 'production') {
        console.error(err.stack || err);
    }

    let statusCode = 500;
    let message = 'Internal Server Error';
    let data = null;

    // Handle Mongoose Validation Errors
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = Object.values(err.errors)
            .map(val => val.message)
            .join(', ');
    }
    // Handle Mongoose CastError (invalid ObjectId)
    else if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid ${err.kind}: ${err.value}`;
    }
    // Handle Duplicate Key Errors
    else if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyPattern)[0];
        message = `Duplicate value for field: ${field}`;
    }
    // Handle JWT Errors
    else if (err.name === 'JsonWebTokenError') {
        statusCode = 401;
        message = 'Invalid or malformed token';
    }
    // Handle Token Expired
    else if (err.name === 'TokenExpiredError') {
        statusCode = 401;
        message = 'Token has expired';
    }
    // Handle Mongoose DocumentNotFound
    else if (err.name === 'DocumentNotFoundError') {
        statusCode = 404;
        message = 'Resource not found';
    }
    // Handle custom HTTP errors (if passed with statusCode property)
    else if (err.statusCode && typeof err.statusCode === 'number') {
        statusCode = err.statusCode;
        message = err.message || 'Error';
    }
    // Generic Error Response
    else {
        statusCode = res.statusCode === 200 ? 500 : res.statusCode;
        message = err.message || 'Internal Server Error';
    }

    // Ensure response is never sent if headers already sent
    if (res.headersSent) {
        return;
    }

    // Return consistent { success, message, data } format
    res.status(statusCode).json({
        success: false,
        message: message,
        data: data || (process.env.NODE_ENV === 'production' ? undefined : { error: err.name })
    });
};

module.exports = errorHandler;
