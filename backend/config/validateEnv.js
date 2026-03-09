// Environment Variable Validation
// This module validates that all required environment variables are present
// Run this at application startup to catch configuration errors early

const requiredEnvVars = [
    'PORT',
    'MONGO_URI',
    'JWT_SECRET',
    'FRONTEND_URL'
];

const optionalEnvVars = [
    'NODE_ENV',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'ALLOWED_EMAIL_DOMAINS',
    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_USER',
    'EMAIL_PASS',
];

function validateEnvironment() {
    const missing = [];
    const warnings = [];

    // Check required variables
    requiredEnvVars.forEach(varName => {
        if (!process.env[varName]) {
            missing.push(varName);
        }
    });

    // Validate JWT_SECRET strength (STRICT in production)
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        if (process.env.NODE_ENV === 'production') {
            missing.push('JWT_SECRET must be at least 32 characters for production security');
        } else {
            warnings.push('JWT_SECRET should be at least 32 characters for security');
        }
    }

    // Validate MONGO_URI format
    if (process.env.MONGO_URI && !process.env.MONGO_URI.startsWith('mongodb')) {
        warnings.push('MONGO_URI should start with "mongodb://" or "mongodb+srv://"');
    }

    // Check optional variables and provide info
    const providedOptional = optionalEnvVars.filter(varName => process.env[varName]);

    // Report results
    if (missing.length > 0) {
        console.error('\n❌ ENVIRONMENT VALIDATION FAILED');
        console.error('Missing required environment variables:');
        missing.forEach(varName => console.error(`  - ${varName}`));
        console.error('\nPlease set these variables in your .env file');
        console.error('See ENVIRONMENT_VARIABLES.md for details\n');
        process.exit(1);
    }

    console.log('\n✅ ENVIRONMENT VALIDATION PASSED');
    console.log(`Required variables: ${requiredEnvVars.length}/${requiredEnvVars.length} present`);
    console.log(`Optional variables: ${providedOptional.length}/${optionalEnvVars.length} configured`);

    if (providedOptional.length > 0) {
        console.log(`  Active features: ${providedOptional.join(', ')}`);
    }

    if (warnings.length > 0) {
        console.log('\n⚠️  WARNINGS:');
        warnings.forEach(warning => console.log(`  - ${warning}`));
    }

    // Display current environment
    console.log(`\n🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔌 Port: ${process.env.PORT}`);
    console.log(`🌐 Frontend: ${process.env.FRONTEND_URL}`);

    if (process.env.ALLOWED_EMAIL_DOMAINS) {
        console.log(`🔒 Domain Restriction: ${process.env.ALLOWED_EMAIL_DOMAINS}`);
    }

    console.log(''); // Empty line for readability
    if (process.env.NODE_ENV === 'production') {
        // In production, avoid verbose env prints; only show critical warnings
        if (warnings.length > 0) {
            console.warn('Environment warnings: ', warnings.join('; '));
        }
    }
}

module.exports = { validateEnvironment };
