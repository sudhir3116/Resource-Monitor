import React, { useContext, useRef, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'

export default function Nav() {
  const navigate = useNavigate()
  const auth = useContext(AuthContext)
  const user = auth ? auth.user : null
  const logout = auth ? auth.logout : null

  function handleLogout() {
    if (typeof logout === 'function') {
      logout()
      navigate('/login')
    }
  }

  function initials(name = '') { return (name || '').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() }

  const avatarSrc = user && (user.avatar || user.picture || null)

  const [open, setOpen] = useState(false)
  const menuRef = useRef()

  useEffect(() => {
    function onDoc(e) {
      if (!menuRef.current) return
      if (e.type === 'keydown' && e.key === 'Escape') return setOpen(false)
      if (e.target && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    document.addEventListener('keydown', onDoc)
    return () => { document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onDoc) }
  }, [])

  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-left">
          <Link to="/" className="brand">
            Resource Monitor
          </Link>
        </div>

        {/* Center Links - Always visible if logged in, or handled by logic */}
        <div className="nav-center">
          {user && (
            <div className="nav-links">
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/alerts">Alerts</Link>
              <Link to="/reports">Reports</Link>
            </div>
          )}
        </div>

        <div className="nav-right">
          {/* Theme Toggle - Always Visible */}
          <ThemeToggle />

          {/* User Profile - Only if logged in */}
          {user && (
            <div className="profile-dropdown" ref={menuRef}>
              <button className="avatar-btn" onClick={(e) => { e.stopPropagation(); setOpen(!open); }} aria-expanded={open} aria-label="Profile menu">
                {avatarSrc ? <img src={avatarSrc} alt="avatar" className="avatar-img" /> : <div className="avatar-initials">{initials(user.name)}</div>}
              </button>

              {open && (
                <div className="dropdown-menu">
                  <div className="dropdown-header">
                    <span className="dropdown-name">{user.name}</span>
                    <span className="dropdown-email">{user.email}</span>
                    <span className="dropdown-role badge" style={{ marginTop: 4, fontSize: 10 }}>{user.role || 'USER'}</span>
                  </div>
                  <div className="dropdown-divider"></div>
                  <Link to="/profile" onClick={() => setOpen(false)}>My Profile</Link>
                  <button onClick={handleLogout} className="dropdown-item-danger">Sign Out</button>
                </div>
              )}
            </div>
          )}

          {/* REMOVED: Login/Register Links for public users */}
        </div>
      </div>
    </nav>
  )
}

