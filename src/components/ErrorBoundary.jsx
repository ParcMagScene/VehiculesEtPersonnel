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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      
      return (
        <div style={{
          padding: '40px',
          background: '#fef2f2',
          color: '#991b1b',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '14px',
          overflow: 'auto',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <h1 style={{fontSize: '24px', marginBottom: '12px'}}>Une erreur est survenue</h1>
          <p style={{color: '#6b7280', marginBottom: '20px', textAlign: 'center'}}>
            L'application a rencontré un problème inattendu.
          </p>
          {isDev && (
            <>
              <pre style={{background: '#fdd', padding: '10px', overflow: 'auto', maxWidth: '90%', marginBottom: '10px', borderRadius: '6px', fontSize: '12px'}}>
                {this.state.error && this.state.error.toString()}
              </pre>
              <pre style={{background: '#fdd', padding: '10px', overflow: 'auto', maxWidth: '90%', fontSize: '11px', borderRadius: '6px'}}>
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </>
          )}
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 24px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Recharger la page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
