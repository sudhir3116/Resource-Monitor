import React, { createContext, useState, useContext, useCallback } from 'react'

const ToastContext = createContext()

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([])

    const addToast = useCallback((message, type = 'success') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => removeToast(id), 3000)
    }, [])

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="toast-container">
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast toast-${toast.type}`}>
                        {toast.type === 'success' && <span style={{ marginRight: 8 }}>✅</span>}
                        {toast.type === 'error' && <span style={{ marginRight: 8 }}>❌</span>}
                        {toast.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export const useToast = () => useContext(ToastContext)
