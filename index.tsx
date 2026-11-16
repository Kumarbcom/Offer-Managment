import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { StudioSite } from './components/StudioSite';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const isStudioSite = window.location.pathname.replace(/\/$/, '') === '/studio';
if (isStudioSite) {
  document.title = 'Morrow Studio — Thoughtful Websites & Brand Design';
  const description = document.querySelector('meta[name="description"]') ?? document.createElement('meta');
  description.setAttribute('name', 'description');
  description.setAttribute('content', 'Morrow Studio creates thoughtful websites, brand identities and digital experiences for ambitious businesses. Tell us about your next project.');
  document.head.appendChild(description);
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("App caught uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px', fontFamily: 'sans-serif' }}>
          <div style={{ maxWidth: '480px', width: '100%', background: '#fff', padding: '28px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px', fontWeight: 'bold' }}>!</div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px' }}>Something went wrong</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px', lineHeight: 1.5 }}>
              {this.state.error?.message || "An unexpected error occurred while loading this page."}
            </p>
            <button
              onClick={() => {
                sessionStorage.clear();
                window.location.reload();
              }}
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Refresh Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {isStudioSite ? <StudioSite /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);
