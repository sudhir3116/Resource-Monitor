import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function Nav() {
  const navigate = useNavigate()
  const token = localStorage.getItem('token')

  function handleLogout() {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand">Sustainable Resource Monitor</Link>
        <div>
          {token ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/usage">Usage</Link>
              <Link to="/alerts">Alerts</Link>
              <Link to="/reports">Reports</Link>
              <Link to="/profile">Profile</Link>
              <button onClick={handleLogout} className="btn-ghost">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
