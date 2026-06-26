import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          margin: '20px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '16px',
          color: '#f8fafc',
          fontFamily: 'Inter, sans-serif'
        }}>
          <h2 style={{ color: '#ef4444', marginTop: 0 }}>Something went wrong.</h2>
          <p style={{ color: '#94a3b8' }}>An unexpected error occurred in this component.</p>
          <details style={{ whiteSpace: 'pre-wrap', background: '#0f172a', padding: '15px', borderRadius: '8px', marginTop: '15px', fontSize: '13px' }}>
            <summary style={{ cursor: 'pointer', color: '#3b82f6', marginBottom: '10px' }}>View Error Details</summary>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo?.componentStack}
          </details>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginTop: '20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
