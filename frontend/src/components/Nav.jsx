import React, { useContext, useRef, useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'

export default function Nav() {
  const navigate = useNavigate()
  const { user, logout } = useContext(AuthContext) || {}
  function handleLogout() { if (typeof logout === 'function') logout() }

  function initials(name = ''){ return (name || '').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase() }

  const avatarSrc = user && (user.avatar || user.picture || null)

  const [open, setOpen] = useState(false)
  const menuRef = useRef()

  useEffect(()=>{
    function onDoc(e){
      if (!menuRef.current) return
      if (e.type === 'keydown' && e.key === 'Escape') return setOpen(false)
      if (e.target && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    document.addEventListener('keydown', onDoc)
    return ()=>{ document.removeEventListener('click', onDoc); document.removeEventListener('keydown', onDoc) }
  },[])
  return (
    <nav className="nav">
      <div className="nav-inner">
        <div className="nav-left">
          <Link to="/" className="brand">Sustainable Resource Consumption Monitor</Link>
        </div>

        {user && (
          <div className="nav-center">
            <div className="nav-links">
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/alerts">Alerts</Link>
              <Link to="/reports">Reports</Link>
            </div>
          </div>
        )}

        <div className="nav-right">
          {user ? (
            <>
              <div className={`profile-dropdown ${open ? 'open' : ''}`} ref={menuRef}>
                <button className="avatar" onClick={()=>setOpen(s=>!s)} aria-expanded={open} aria-label="Profile menu">
                  {avatarSrc ? <img src={avatarSrc} alt="avatar" className="avatar-img" /> : initials(user.name)}
                </button>
                <div className="dropdown-menu">
                  <Link to="/profile">View Profile</Link>
                  <Link to="/profile">Change Password</Link>
                  <button onClick={handleLogout} className="btn-ghost">Logout</button>
                </div>
              </div>
              <ThemeToggle />
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
              <ThemeToggle />
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
