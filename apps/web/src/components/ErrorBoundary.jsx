import React from 'react';

import { Button } from '@/design-system';
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(_error) {
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
      const { moduleName } = this.props;
      const isInline = !!moduleName;
      
      const bg = 'var(--theme-danger-bg, #fef2f2)';
      const textColor = 'var(--theme-danger-text, #991b1b)';
      const mutedColor = 'var(--theme-text-gray, #6b7280)';
      const preBg = 'var(--theme-bg-secondary, #fdd)';
      const btnBg = 'var(--theme-danger, #dc2626)';
      
      return (
        <div style={{
          padding: isInline ? '24px' : '40px',
          background: bg,
          color: textColor,
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '14px',
          overflow: 'auto',
          height: isInline ? 'auto' : '100vh',
          minHeight: isInline ? '200px' : undefined,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: isInline ? '12px' : undefined,
          margin: isInline ? '16px' : undefined,
        }}>
          <h1 style={{fontSize: isInline ? '18px' : '24px', marginBottom: '12px'}}>
            {moduleName ? `Erreur dans le module ${moduleName}` : 'Une erreur est survenue'}
          </h1>
          <p style={{color: mutedColor, marginBottom: '20px', textAlign: 'center'}}>
            L'application a rencontré un problème inattendu.
          </p>
          {isDev && (
            <>
              <pre style={{background: preBg, padding: '10px', overflow: 'auto', maxWidth: '90%', marginBottom: '10px', borderRadius: '6px', fontSize: '12px'}}>
                {this.state.error && this.state.error.toString()}
              </pre>
              <pre style={{background: preBg, padding: '10px', overflow: 'auto', maxWidth: '90%', fontSize: '11px', borderRadius: '6px'}}>
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </>
          )}
          <Button variant="ghost" 
            onClick={() => isInline ? this.setState({ hasError: false, error: null, errorInfo: null }) : window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 24px',
              background: btnBg,
              color: 'var(--theme-text-inverse, white)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer'
            }}
          >
            Recharger la page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
