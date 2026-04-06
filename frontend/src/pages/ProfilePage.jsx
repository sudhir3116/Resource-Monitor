import React, { useState, useEffect, useContext } from 'react';
import { Eye, EyeOff, Save, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';


const ProfilePage = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || '',
    block: user?.block || '',
    room: user?.room || ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [activityLogs, setActivityLogs] = useState([]);

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchActivityLogs();
    }
  }, [activeTab]);

  const fetchActivityLogs = async () => {
    try {
      const response = await api.get('/audit-logs', {
        params: { actions: 'all', limit: 10 }
      });
      setActivityLogs(response.data.data || []);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    }
  };

  const calculatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    setPasswordStrength(strength);
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({ ...passwordData, [name]: value });
    if (name === 'newPassword') {
      calculatePasswordStrength(value);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.put('/profile', {
        name: profileData.name
      });
      setMessage({ type: 'success', text: 'Profile updated successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    try {
      setLoading(true);
      await api.put('/profile/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword
      });
      setMessage({ type: 'success', text: 'Password changed successfully. Please login again.' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        logout();
      }, 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to change password' });
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrengthLabel = () => {
    if (passwordStrength === 0) return '';
    if (passwordStrength <= 2) return 'Weak';
    if (passwordStrength <= 3) return 'Medium';
    if (passwordStrength === 4) return 'Strong';
    return 'Very Strong';
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength === 0) return '';
    if (passwordStrength <= 2) return 'bg-red-500';
    if (passwordStrength <= 3) return 'bg-yellow-500';
    if (passwordStrength === 4) return 'bg-blue-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      {/* Header (Task 1) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Profile</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Manage your account information and security settings
          </p>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${message.type === 'success'
          ? 'bg-green-500/10 text-green-500 border border-green-500/20'
          : 'bg-red-500/10 text-red-500 border border-red-500/20'
          }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Main Container (Task 2) */}
      <div className="card !p-0 overflow-hidden">
        {/* Tabs (Task 5) */}
        <div className="flex border-b border-slate-800 px-6">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-4 text-sm font-medium transition-all relative ${activeTab === 'profile'
              ? 'text-blue-500'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Edit Profile
            {activeTab === 'profile' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-4 py-4 text-sm font-medium transition-all relative ${activeTab === 'password'
              ? 'text-blue-500'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            Change Password
            {activeTab === 'password' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-4 py-4 text-sm font-medium transition-all relative ${activeTab === 'activity'
              ? 'text-blue-500'
              : 'text-slate-400 hover:text-slate-200'
              }`}
          >
            My Activity
            {activeTab === 'activity' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
        </div>

        {/* Content Area (Task 3 & Task 7) */}
        <div className="p-6 md:p-8 space-y-6">
          {/* Edit Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileUpdate} className="space-y-6 max-w-2xl">
              <div className="flex items-center gap-4 mb-8 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/50">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold border-4 border-white dark:border-slate-900 shadow-xl">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{user?.name}</h3>
                  <p className="text-blue-500 text-xs font-bold uppercase tracking-widest">{user?.role}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Full Name</label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-transparent p-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Email Address (Read-only)</label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="input-field w-full rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 text-sm text-slate-400 opacity-60 cursor-not-allowed outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Your Role (Read-only)</label>
                  <input
                    type="text"
                    value={profileData.role.charAt(0).toUpperCase() + profileData.role.slice(1)}
                    disabled
                    className="input-field w-full rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 text-sm text-slate-400 opacity-60 cursor-not-allowed outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Assigned Block (Read-only)</label>
                  <input
                    type="text"
                    value={typeof profileData.block === 'object' ? profileData.block.name : (profileData.block || 'Not assigned')}
                    disabled
                    className="input-field w-full rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 text-sm text-slate-400 opacity-60 cursor-not-allowed outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-all disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* Change Password Tab */}
          {activeTab === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-md">
              {user?.provider === 'google' ? (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg text-sm italic">
                  You are using Google authentication. Password management is handled through your Google account settings.
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Current Password</label>
                    <div className="relative">
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-transparent p-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 transition-all pr-10"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">New Password</label>
                    <div className="relative">
                      <input
                        type={showPasswords.new ? 'text' : 'password'}
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-transparent p-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 transition-all pr-10"
                        placeholder="At least 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {passwordData.newPassword && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Security Strength</span>
                          <span className={`text-[10px] font-bold uppercase ${passwordStrength <= 2 ? 'text-red-500' :
                            passwordStrength <= 3 ? 'text-yellow-500' : 'text-green-500'
                            }`}>{getPasswordStrengthLabel()}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex gap-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <div
                              key={s}
                              className={`h-full flex-1 transition-all ${s <= passwordStrength ? getPasswordStrengthColor() : 'bg-slate-700/30'
                                }`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Confirm New Password</label>
                    <div className="relative">
                      <input
                        type={showPasswords.confirm ? 'text' : 'password'}
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-transparent p-2.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500 transition-all pr-10"
                        placeholder="Repeat new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="btn-primary w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
                    >
                      {loading ? 'Changing Password...' : 'Update Password'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              {activityLogs.length === 0 ? (
                <div className="py-10 text-center">
                  <AlertCircle size={40} className="mx-auto text-slate-700 mb-3" />
                  <p className="text-slate-500 text-sm">No recent activity logs found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activityLogs.map((log, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-slate-800/40 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-blue-500 border border-slate-700">
                          <ShieldCheck size={20} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-200 text-sm group-hover:text-blue-400 transition-colors">{log.action || log.resourceType}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{log.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-500 flex items-center justify-end gap-1.5 bg-slate-800/50 px-2 py-1 rounded-md">
                          <Clock size={10} />
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
