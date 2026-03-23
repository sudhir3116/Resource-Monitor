import React, { useState, useEffect, useContext } from 'react';
import { Plus, Trash2, Edit2, MapPin, Clock, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';


const AnnouncementBoard = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [filterType, setFilterType] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'GENERAL',
    priority: 'MEDIUM',
    targetRole: ['all'],
    targetBlock: null,
    expiresAt: '',
    pinned: false
  });

  const role = (user?.role || '').toLowerCase();
  const isAdmin = ['admin', 'gm', 'warden'].includes(role);

  useEffect(() => {
    fetchAnnouncements();
  }, [filterType, filterPriority]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        limit: 50,
        page: 1
      };
      if (filterType !== 'All') params.type = filterType;
      if (filterPriority !== 'All') params.priority = filterPriority;

      const res = await api.get('/api/announcements', { params });

      // API returns: { success: true, data: { announcements: [...], pagination: {...} } }
      const announcements = res.data?.data?.announcements || [];

      console.log('[NoticeBoard] Fetched:', announcements.length, 'announcements');
      setAnnouncements(announcements);

    } catch (err) {
      console.error('[NoticeBoard] Error:', err.response?.status, err.response?.data);

      // If 404 — endpoint doesn't exist
      // Show empty state instead of error
      if (err.response?.status === 404) {
        setAnnouncements([]);
        setError(null); // clear error — show empty state
      } else if (err.response?.status === 401) {
        setError('Session expired. Please login again.');
      } else {
        setError('Failed to fetch announcements. Check console for details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFormError(null);

      const payload = {
        title: formData.title?.trim(),
        content: formData.content?.trim(),
        type: formData.type || 'GENERAL',
        priority: formData.priority || 'MEDIUM',
        targetRole: formData.targetRole || ['all'],
        pinned: formData.pinned || false,
        expiresAt: formData.expiresAt || null
      };

      // Validate required fields
      if (!payload.title || !payload.content) {
        setFormError('Title and content are required');
        return;
      }

      if (editId) {
        await api.put(`/api/announcements/${editId}`, payload);
      } else {
        await api.post('/api/announcements', payload);
      }

      // Success
      setShowForm(false);
      setFormData({
        title: '',
        content: '',
        type: 'GENERAL',
        priority: 'MEDIUM',
        targetRole: ['all'],
        targetBlock: null,
        expiresAt: '',
        pinned: false
      });
      setEditId(null);
      await fetchAnnouncements(); // refresh list

    } catch (err) {
      console.error('[NoticeBoard] Post error:', err);
      setFormError(err.response?.data?.message || 'Failed to post announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this announcement?')) {
      try {
        await api.delete(`/api/announcements/${id}`);
        fetchAnnouncements();
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete announcement');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-xl">
                📢
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Notice Board
                </h1>
                <p className="text-sm text-gray-400 mt-0.5">
                  Official announcements for all hostel residents
                </p>
              </div>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                setShowForm(!showForm);
                setEditId(null);
                setFormError(null);
                setFormData({
                  title: '',
                  content: '',
                  type: 'GENERAL',
                  priority: 'MEDIUM',
                  targetRole: ['all'],
                  targetBlock: null,
                  expiresAt: '',
                  pinned: false
                });
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 active:bg-blue-800 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              <span className="text-lg font-light">+</span>
              Post Announcement
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer shadow-sm min-w-[130px]"
          >
            <option>All</option>
            <option>GENERAL</option>
            <option>MAINTENANCE</option>
            <option>EMERGENCY</option>
            <option>RESOURCE</option>
            <option>EVENT</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer shadow-sm min-w-[130px]"
          >
            <option>All</option>
            <option>URGENT</option>
            <option>HIGH</option>
            <option>MEDIUM</option>
            <option>LOW</option>
          </select>

          <span className="text-xs text-gray-400 ml-auto">
            {announcements.length} announcement{announcements.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <span className="text-red-500 mt-0.5 flex-shrink-0">⚠</span>
            <div className="flex-1">
              <p className="text-red-700 text-sm font-medium">{error}</p>
              <p className="text-red-500 text-xs mt-0.5">Check that the backend is running on port 5001</p>
            </div>
            <button
              onClick={fetchAnnouncements}
              className="text-xs text-red-600 hover:text-red-800 font-medium border border-red-300 rounded px-2 py-1 hover:bg-red-100 transition-colors flex-shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Create/Edit Form Modal */}
        {showForm && isAdmin && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">

              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
                <h2 className="text-xl font-bold">{editId ? 'Edit' : 'Post New'} Announcement</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                  <span className="text-2xl font-light">&times;</span>
                </button>
              </div>

              <div className="p-6 overflow-y-auto">
                {formError && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                    {formError}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      maxLength="100"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 bg-white"
                      placeholder="Announcement title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                    <textarea
                      maxLength="2000"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      required
                      rows="4"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 bg-white"
                      placeholder="Announcement content"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={formData.type}
                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        <option>GENERAL</option>
                        <option>MAINTENANCE</option>
                        <option>EMERGENCY</option>
                        <option>RESOURCE</option>
                        <option>EVENT</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        <option>LOW</option>
                        <option>MEDIUM</option>
                        <option>HIGH</option>
                        <option>URGENT</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.pinned}
                        onChange={(e) => setFormData({ ...formData, pinned: e.target.checked })}
                      />
                      <span className="text-sm font-medium text-gray-700">Pin to top</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expires At (Optional)</label>
                    <input
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    />
                  </div>

                  <div className="mt-6 flex gap-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed justify-center"
                    >
                      {submitting ? 'Saving...' : (editId ? 'Update' : 'Post') + ' Announcement'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="w-full py-2.5 bg-gray-400 text-white rounded-lg font-medium text-sm hover:bg-gray-500 transition-colors justify-center"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12 text-gray-500">Loading announcements...</div>
        )}

        {/* Empty State */}
        {!loading && !error && announcements.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center text-4xl mb-4 shadow-inner">
              📢
            </div>
            <h3 className="text-gray-700 font-semibold text-lg">
              No announcements yet
            </h3>
            <p className="text-gray-400 text-sm mt-2 max-w-sm leading-relaxed">
              {isAdmin
                ? 'Post the first announcement to notify all hostel residents'
                : 'No announcements have been posted yet. Check back later.'
              }
            </p>
            {isAdmin && (
              <button
                onClick={() => {
                  setShowForm(true);
                  setEditId(null);
                  setFormError(null);
                  setFormData({
                    title: '', content: '', type: 'GENERAL', priority: 'MEDIUM',
                    targetRole: ['all'], targetBlock: null, expiresAt: '', pinned: false
                  });
                }}
                className="mt-5 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm flex items-center gap-2"
              >
                <span className="text-base">+</span>
                Post First Announcement
              </button>
            )}
          </div>
        )}

        {/* Announcements List */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {announcements.map((announcement) => (
            <div
              key={announcement._id}
              className={`
                bg-white rounded-xl border border-gray-200 border-l-4 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col
                ${announcement.priority === 'URGENT' || announcement.priority === 'EMERGENCY'
                  ? 'border-l-red-500'
                  : announcement.priority === 'HIGH'
                    ? 'border-l-orange-500'
                    : announcement.priority === 'MEDIUM'
                      ? 'border-l-blue-500'
                      : 'border-l-gray-300'
                }
                ${announcement.priority === 'EMERGENCY' ? 'animate-pulse' : ''}
              `}
            >

              {/* Card Top Row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">

                  {/* Priority Badge */}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${announcement.priority === 'URGENT' || announcement.priority === 'EMERGENCY'
                      ? 'bg-red-100 text-red-700'
                      : announcement.priority === 'HIGH'
                        ? 'bg-orange-100 text-orange-700'
                        : announcement.priority === 'MEDIUM'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                    }`}>
                    {announcement.priority}
                  </span>

                  {/* Type Badge */}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                    {announcement.type || 'GENERAL'}
                  </span>

                  {/* Pinned Badge */}
                  {announcement.pinned && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium flex items-center gap-1">
                      📌 Pinned
                    </span>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditId(announcement._id);
                        setFormData(announcement);
                        setShowForm(true);
                      }}
                      className="text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0 p-1 rounded hover:bg-blue-50"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(announcement._id)}
                      className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 p-1 rounded hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Title */}
              <h3 className="font-semibold text-gray-900 text-base mt-3 leading-snug">
                {announcement.title}
              </h3>

              {/* Content */}
              <p className="text-gray-600 text-sm mt-2 leading-relaxed line-clamp-3 mb-4 flex-1 whitespace-pre-line">
                {announcement.content}
              </p>

              {/* Card Footer */}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                    {(announcement.createdBy?.name || 'A')[0].toUpperCase()}
                  </div>
                  <span className="text-xs text-gray-500">
                    {announcement.createdBy?.name || 'Admin'}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {announcement.targetRole && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      👥 {Array.isArray(announcement.targetRole)
                        ? announcement.targetRole.join(', ')
                        : announcement.targetRole}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    🕒 {new Date(announcement.createdAt).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </span>
                </div>
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnnouncementBoard;
