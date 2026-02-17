import React, { Component } from 'react';

class GlobalErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('CRITICAL APP ERROR:', error, errorInfo);
        this.setState({ error, errorInfo });
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
                    backgroundColor: '#f8d7da',
                    color: '#721c24',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px',
                    zIndex: 9999,
                    fontFamily: 'system-ui, sans-serif'
                }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Application Failed to Load</h1>
                    <p style={{ maxWidth: '600px', textAlign: 'center', marginBottom: '2rem' }}>
                        We encountered a critical error. Please check the browser console for details.
                    </p>
                    <details style={{ whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,0.5)', padding: '1rem', borderRadius: '4px' }}>
                        {this.state.error && this.state.error.toString()}
                    </details>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            marginTop: '2rem',
                            padding: '10px 20px',
                            border: 'none',
                            background: '#721c24',
                            color: 'white',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1rem'
                        }}
                    >
                        Reload Application
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
