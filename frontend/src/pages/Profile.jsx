import React, { useEffect, useState, useContext } from 'react'
import api from '../services/api'
import Loading from '../components/Loading'
import { AuthContext } from '../context/AuthContext'

export default function Profile() {
  const { logout, checkAuth } = useContext(AuthContext)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Profile Form State
  const [profileData, setProfileData] = useState({ name: '', avatar: '' })
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' })

  // Password Form State
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' })
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    try {
      const d = await api.get('/api/profile')
      setUser(d.user)
      setProfileData({ name: d.user.name || '', avatar: d.user.avatar || '' })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function updateProfile(e) {
    e.preventDefault()
    setProfileMsg({ type: '', text: '' })
    try {
      await api.put('/api/profile', profileData)
      setProfileMsg({ type: 'success', text: 'Profile updated successfully' })
      await checkAuth() // Refresh global auth state
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile' })
    }
  }

  async function changePw(e) {
    e.preventDefault()
    setPwMsg({ type: '', text: '' })
    try {
      await api.put('/api/profile/password', pw)
      setPwMsg({ type: 'success', text: 'Password changed successfully' })
      setPw({ currentPassword: '', newPassword: '' })
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message || 'Failed to change password' })
    }
  }

  if (loading) return <Loading />
  if (error) return <div className="p-4 text-red-600 bg-red-100 rounded">{error}</div>
  if (!user) return null

  return (
    <div className="container fade-in" style={{ maxWidth: 800, margin: '0 auto', padding: '20px' }}>
      <h1 className="page-title" style={{ marginBottom: 24, fontSize: '2rem', fontWeight: 'bold' }}>My Profile</h1>

      {/* Profile Details Card */}
      <div className="card" style={{ marginBottom: 24, background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div className="card-header" style={{ padding: '16px 24px', borderBottom: '1px solid #eee' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Personal Information</h2>
        </div>
        <div className="card-body" style={{ padding: 24 }}>

          <form onSubmit={updateProfile}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>Full Name</label>
              <input
                type="text"
                className="form-control"
                value={profileData.name}
                onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                required
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>Avatar URL</label>
              <input
                type="url"
                className="form-control"
                value={profileData.avatar}
                onChange={e => setProfileData({ ...profileData, avatar: e.target.value })}
                placeholder="https://example.com/avatar.jpg"
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>Email Address</label>
              <input
                type="email"
                className="form-control"
                value={user.email}
                disabled
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db', backgroundColor: '#f3f4f6', color: '#6b7280' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600, color: '#374151' }}>Role</label>
              <span className={`badge ${['admin', 'principal', 'dean'].includes(user.role) ? 'badge-primary' : 'badge-secondary'}`}
                style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '0.875rem', fontWeight: 600, backgroundColor: '#e5e7eb', color: '#374151' }}>
                {user.role ? user.role.toUpperCase() : 'USER'}
              </span>
            </div>

            {profileMsg.text && (
              <div className={`alert ${profileMsg.type === 'error' ? 'alert-error' : 'alert-success'}`}
                style={{
                  padding: 12, borderRadius: 6, marginBottom: 16,
                  backgroundColor: profileMsg.type === 'error' ? '#fee2e2' : '#dcfce7',
                  color: profileMsg.type === 'error' ? '#991b1b' : '#166534'
                }}>
                {profileMsg.text}
              </div>
            )}

            <div style={{ textAlign: 'right' }}>
              <button type="submit" className="primary-btn" style={{ padding: '10px 24px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>
                Save Changes
              </button>
            </div>
          </form>

        </div>
      </div>

      {/* Password Change Card */}
      <div className="card" style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div className="card-header" style={{ padding: '16px 24px', borderBottom: '1px solid #eee' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Security Settings</h2>
        </div>
        <div className="card-body" style={{ padding: 24 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 16, fontWeight: 600, color: '#4b5563' }}>Change Password</h3>
          <form onSubmit={changePw}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>Current Password</label>
              <input
                type="password"
                className="form-control"
                value={pw.currentPassword}
                onChange={e => setPw({ ...pw, currentPassword: e.target.value })}
                required
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>New Password</label>
              <input
                type="password"
                className="form-control"
                value={pw.newPassword}
                onChange={e => setPw({ ...pw, newPassword: e.target.value })}
                required
                style={{ width: '100%', padding: '10px', borderRadius: 6, border: '1px solid #d1d5db' }}
              />
            </div>
            {pwMsg.text && (
              <div style={{
                padding: 12, borderRadius: 6, marginBottom: 16,
                backgroundColor: pwMsg.type === 'error' ? '#fee2e2' : '#dcfce7',
                color: pwMsg.type === 'error' ? '#991b1b' : '#166534'
              }}>
                {pwMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-danger"
                onClick={logout}
                style={{ padding: '10px 24px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Sign Out
              </button>
              <button type="submit" className="primary-btn" style={{ padding: '10px 24px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                Update Password
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
