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
        localStorage.clear();
        window.location.href = '/login';
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100vh',
                    backgroundColor: '#0f172a',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    zIndex: 9999,
                    fontFamily: 'system-ui, sans-serif',
                    overflow: 'auto'
                }}>
                    <div style={{ maxWidth: '500px', textAlign: 'center' }}>
                        <div style={{
                            fontSize: '4rem',
                            marginBottom: '1rem',
                            opacity: 0.8
                        }}>
                            ⚠️
                        </div>
                        <h1 style={{
                            fontSize: '2rem',
                            marginBottom: '0.5rem',
                            color: '#f1f5f9',
                            fontWeight: 'bold'
                        }}>
                            Oops! Something went wrong
                        </h1>
                        <p style={{
                            fontSize: '1rem',
                            color: '#cbd5e1',
                            marginBottom: '2rem',
                            lineHeight: '1.6'
                        }}>
                            The application encountered an unexpected error and had to stop. 
                            Try reloading or clearing your browser cache and trying again.
                        </p>

                        {process.env.NODE_ENV === 'development' && (
                            <details style={{
                                textAlign: 'left',
                                background: 'rgba(30, 41, 59, 0.8)',
                                padding: '1rem',
                                borderRadius: '6px',
                                marginBottom: '2rem',
                                border: '1px solid rgba(203, 213, 225, 0.2)',
                                color: '#cbd5e1',
                                fontSize: '0.875rem'
                            }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#f87171' }}>
                                    Error Details (Development Only)
                                </summary>
                                <pre style={{
                                    marginTop: '1rem',
                                    overflow: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    color: '#fca5a5'
                                }}>
                                    {this.state.error && this.state.error.toString()}
                                    {this.state.errorInfo && '\n\n' + this.state.errorInfo.componentStack}
                                </pre>
                            </details>
                        )}

                        <div style={{
                            display: 'flex',
                            gap: '1rem',
                            justifyContent: 'center',
                            flexWrap: 'wrap'
                        }}>
                            <button
                                onClick={() => window.location.reload()}
                                style={{
                                    padding: '10px 20px',
                                    border: 'none',
                                    background: '#3b82f6',
                                    color: 'white',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: '500',
                                    transition: 'background 0.2s'
                                }}
                                onMouseOver={(e) => e.target.style.background = '#2563eb'}
                                onMouseOut={(e) => e.target.style.background = '#3b82f6'}
                            >
                                🔄 Reload Page
                            </button>
                            <button
                                onClick={this.handleReset}
                                style={{
                                    padding: '10px 20px',
                                    border: '1px solid #cbd5e1',
                                    background: 'transparent',
                                    color: '#cbd5e1',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: '500',
                                    transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => {
                                    e.target.style.background = 'rgba(203, 213, 225, 0.1)';
                                    e.target.style.color = '#f1f5f9';
                                }}
                                onMouseOut={(e) => {
                                    e.target.style.background = 'transparent';
                                    e.target.style.color = '#cbd5e1';
                                }}
                            >
                                🔑 Go to Login
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
