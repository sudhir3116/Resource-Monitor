import React, { useContext, useRef, useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import { ROLES } from '../utils/roles'
import ThemeToggle from './ThemeToggle'

export default function Nav() {
  const location = useLocation()
  const { user, logout } = useContext(AuthContext)
  const [open, setOpen] = useState(false)
  const menuRef = useRef()

  function initials(name = '') { return (name || '').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() }
  const avatarSrc = user && (user.avatar || user.picture || null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      // If clicking outside the menu ref (which should wrap button and menu)
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  function handleLogout() {
    setOpen(false)
    if (logout) logout()
  }

  // Prevent seeing login/register links on those pages
  const isAuthPage = ['/login', '/register', '/forgot'].some(path => location.pathname.startsWith(path))

  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-left">
          {/* Brand link goes to dashboard if user logs in, else landing/login */}
          <Link to={user ? "/dashboard" : "/"} className="brand">
            Resource Monitor
          </Link>
        </div>

        {/* Center Links - Only visible if logged in */}
        <div className="nav-center">
          {user && (
            <div className="nav-links">
              <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>

              {/* Admin Dashboard for all Admin-like roles */}
              {[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.WARDEN].includes(user.role) && (
                <Link to="/admin" className={location.pathname.startsWith('/admin') ? 'active' : ''}>Admin</Link>
              )}

              <Link to="/alerts" className={location.pathname.startsWith('/alerts') ? 'active' : ''}>Alerts</Link>

              {/* Reports for Upper Management */}
              {[ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN, ROLES.WARDEN].includes(user.role) && (
                <Link to="/reports" className={location.pathname === '/reports' ? 'active' : ''}>Reports</Link>
              )}
            </div>
          )}
        </div>

        <div className="nav-right">
          <ThemeToggle />

          {/* User Profile - Only if logged in */}
          {user ? (
            <div className={`profile-dropdown ${open ? 'open' : ''}`} ref={menuRef}>
              <button
                className="avatar-btn"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-label="Profile menu"
                title={user.name}
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="avatar" className="avatar-img" />
                ) : (
                  <div className="avatar-initials">{initials(user.name)}</div>
                )}
              </button>

              {open && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    <span className="dropdown-name">{user.name}</span>
                    <span className="dropdown-email">{user.email}</span>
                    <span className="dropdown-role badge">{user.role || 'USER'}</span>
                  </div>
                  <div className="dropdown-divider"></div>

                  <Link
                    to="/profile"
                    onClick={() => setOpen(false)}
                    className="dropdown-item"
                  >
                    My Profile
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="dropdown-item dropdown-item-danger"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            !isAuthPage && (
              <div className="nav-links">
                <Link to="/login" style={{ marginRight: 15 }}>Login</Link>
                <Link to="/register" className="btn btn-primary">Register</Link>
              </div>
            )
          )}
        </div>
      </div>
    </nav>
  )
}

