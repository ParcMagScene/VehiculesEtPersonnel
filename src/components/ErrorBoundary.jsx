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
      return (
        <div style={{
          padding: '20px',
          background: '#fee',
          color: '#c00',
          fontFamily: 'monospace',
          fontSize: '14px',
          overflow: 'auto',
          height: '100vh'
        }}>
          <h1 style={{fontSize: '24px', marginBottom: '20px'}}>Erreur détectée</h1>
          <h2 style={{fontSize: '18px', marginBottom: '10px'}}>Message:</h2>
          <pre style={{background: '#fdd', padding: '10px', overflow: 'auto'}}>
            {this.state.error && this.state.error.toString()}
          </pre>
          <h2 style={{fontSize: '18px', marginTop: '20px', marginBottom: '10px'}}>Stack trace:</h2>
          <pre style={{background: '#fdd', padding: '10px', overflow: 'auto', fontSize: '12px'}}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#c00',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '16px'
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
