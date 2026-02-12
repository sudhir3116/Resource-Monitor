import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import ErrorBoundary from './components/ErrorBoundary'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)

// quick sanity log to ensure main executed
console.log('main.jsx mounted')

// global error logging
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => console.error('Global error', e.error || e.message))
  window.addEventListener('unhandledrejection', (ev) => console.error('Unhandled rejection', ev.reason))
}

// debug banner removed
