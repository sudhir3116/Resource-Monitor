import React, { useContext } from 'react'
import { Navigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import Loading from './Loading'

export default function PublicRoute({ children }) {
    const { user, loading } = useContext(AuthContext)

    if (loading) return <Loading />

    // If user is authenticated, redirect to dashboard
    if (user) {
        return <Navigate to="/dashboard" replace />
    }

    // Otherwise, allow access to public page (Login/Register)
    return children
}
