const errorHandler = (err, req, res, next) => {
    // Only log full stack in development
    if (process.env.NODE_ENV !== 'production') {
        console.error(err.stack);
    }

    const statusCode = res.statusCode === 200 ? 500 : res.statusCode; // Default to 500 if no status set

    // Handle Mongoose Validation Errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: Object.values(err.errors).map(val => val.message).join(', ')
        });
    }

    // Handle Duplicate Key Errors
    if (err.code === 11000) {
        return res.status(409).json({
            success: false,
            message: 'Duplicate field value entered'
        });
    }

    // Handle JWT Errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expired'
        });
    }

    // Generic Error Response
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Server Error',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

module.exports = errorHandler;
