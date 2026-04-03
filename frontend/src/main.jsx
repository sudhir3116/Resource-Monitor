import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import AuthProvider from './context/AuthProvider'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { AlertCountProvider } from './context/AlertCountProvider'
import GlobalErrorBoundary from './components/GlobalErrorBoundary'
import { logger } from './utils/logger'

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

try {
  const root = createRoot(rootElement);

  root.render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <AlertCountProvider>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </AlertCountProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </GlobalErrorBoundary>
    </React.StrictMode>
  );
  logger.log('React app mounted successfully');
} catch (error) {
  logger.error('Error mounting React app:', error);
  document.body.innerHTML = '<div style="color:red; padding:20px;"><h2>Application Failed to Start</h2><p>Check console for details.</p></div>';
}
