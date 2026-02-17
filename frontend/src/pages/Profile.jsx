import React, { useEffect, useState, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { User, Mail, Shield, Key, Camera, Lock, Check, AlertCircle } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';

export default function Profile() {
  const { user: authUser, checkAuth } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: authUser?.name || '',
    avatar: authUser?.avatar || ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    if (authUser) {
      setProfileData({
        name: authUser.name || '',
        avatar: authUser.avatar || ''
      });
    }
  }, [authUser]);

  async function updateProfile(e) {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setLoading(true);

    try {
      await api.put('/api/profile', profileData);
      setMessage({ type: 'success', text: 'Profile updated successfully' });
      await checkAuth();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  }

  async function changePw(e) {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (pw.newPassword !== pw.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setLoading(true);
    try {
      await api.put('/api/profile/password', {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword
      });
      setMessage({ type: 'success', text: 'Password changed successfully' });
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 style={{ color: 'var(--text-primary)' }}>Profile Settings</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Manage your account settings and preferences
        </p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${message.type === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
          {message.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - User Info Card */}
        <div className="lg:col-span-1">
          <Card>
            <div className="flex flex-col items-center text-center p-4">
              <div className="relative mb-4">
                <div className="h-24 w-24 rounded-full flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: 'var(--bg-hover)' }}>
                  {authUser?.avatar ? (
                    <img src={authUser.avatar} alt={authUser.name} className="h-full w-full object-cover" />
                  ) : (
                    <User size={40} style={{ color: 'var(--text-secondary)' }} />
                  )}
                </div>
                <button className="absolute bottom-0 right-0 p-2 rounded-full shadow-lg"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <Camera size={14} style={{ color: 'var(--text-primary)' }} />
                </button>
              </div>

              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{authUser?.name}</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{authUser?.email}</p>

              <Badge variant="primary" className="mb-4">{authUser?.role}</Badge>

              <div className="w-full pt-4 border-t space-y-3 text-left" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Block</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{authUser?.block || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Joined</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {new Date(authUser?.createdAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column - Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Information */}
          <Card title="General Information">
            <form onSubmit={updateProfile} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    className="input pl-10"
                    value={profileData.name}
                    onChange={e => setProfileData({ ...profileData, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    className="input pl-10"
                    value={authUser?.email}
                    disabled
                    style={{ backgroundColor: 'var(--bg-hover)', cursor: 'not-allowed' }}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Email address cannot be changed. Contact admin for assistance.
                </p>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Security */}
          {authUser?.provider !== 'google' && (
            <Card title="Security">
              <form onSubmit={changePw} className="space-y-4">
                <div>
                  <label className="label">Current Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      className="input pl-10"
                      value={pw.currentPassword}
                      onChange={e => setPw({ ...pw, currentPassword: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">New Password</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="password"
                        className="input pl-10"
                        value={pw.newPassword}
                        onChange={e => setPw({ ...pw, newPassword: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">Confirm New Password</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="password"
                        className="input pl-10"
                        value={pw.confirmPassword}
                        onChange={e => setPw({ ...pw, confirmPassword: e.target.value })}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="secondary" disabled={loading}>
                    {loading ? 'Updating...' : 'Update Password'}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
