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

root.render(
  <React.StrictMode>
    {isStudioSite ? <StudioSite /> : <App />}
  </React.StrictMode>
);
