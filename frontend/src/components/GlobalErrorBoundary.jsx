import React, { Component } from 'react';
import { logger } from '../utils/logger';

class GlobalErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        logger.error('CRITICAL APP ERROR:', error, errorInfo);
        this.setState({ error, errorInfo });
    }

    handleReset = () => {
        window.location.href = '/login';
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
                    <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full text-center border border-gray-800 shadow-2xl">
                        <div className="text-5xl mb-4">⚠️</div>
                        <h2 className="text-xl font-bold text-white mb-2">
                            Something went wrong
                        </h2>
                        <p className="text-gray-400 text-sm mb-6">
                            An unexpected error occurred. Please refresh the page to continue.
                        </p>

                        {/* Only show error detail in development */}
                        {import.meta.env.DEV && this.state.error && (
                            <div className="bg-red-950/50 border border-red-800/50 rounded-lg p-3 mb-6 text-left">
                                <p className="text-red-400 text-xs font-mono break-all">
                                    {this.state.error.message}
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors text-sm"
                            >
                                Refresh Page
                            </button>
                            <button
                                onClick={() => {
                                    window.location.href = '/login'
                                }}
                                className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors text-sm"
                            >
                                Go to Login
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
