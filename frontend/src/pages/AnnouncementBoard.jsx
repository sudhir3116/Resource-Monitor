import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Plus, Trash2, Edit2, MapPin, Clock, AlertCircle, Megaphone, Info, RefreshCw, User, Calendar, Tag, ShieldCheck } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { getSocket } from '../utils/socket';
import { useToast } from '../context/ToastContext';
import timeAgo from '../utils/timeAgo';

const AnnouncementBoard = () => {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [filterType, setFilterType] = useState('All');
  const [filterBlock, setFilterBlock] = useState('All');
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
  const canCreate = ['admin', 'gm', 'dean', 'principal'].includes(role);
  const canManageNotice = (notice) => {
    if (['admin', 'gm'].includes(role)) return true;
    if (role === 'dean' && notice.createdBy?._id === user?._id) return true;
    return false;
  };

  const fetchMeta = useCallback(async () => {
    try {
      const res = await api.get('/api/admin/blocks');
      setBlocks(res.data.data || []);
    } catch (e) { }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (filterType !== 'All') params.type = filterType;
      if (filterBlock !== 'All') params.blockId = filterBlock;

      const res = await api.get('/api/announcements', { params });
      const data = res.data?.data?.announcements || res.data?.notices || res.data || [];
      setAnnouncements(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to fetch announcements');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterBlock]);

  useEffect(() => {
    fetchMeta();
    fetchAnnouncements();
  }, [fetchMeta, fetchAnnouncements]);

  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      socket.on('notice:created', fetchAnnouncements);
      socket.on('announcement:new', fetchAnnouncements);
    }
    return () => {
      if (socket) {
        socket.off('notice:created', fetchAnnouncements);
        socket.off('announcement:new', fetchAnnouncements);
      }
    };
  }, [fetchAnnouncements]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title?.trim() || !formData.content?.trim()) {
      setFormError('Title and content are required');
      return;
    }
    try {
      setSubmitting(true);
      setFormError(null);

      const payload = { ...formData };

      if (editId) {
        await api.put(`/api/announcements/${editId}`, payload);
        addToast('Announcement updated', 'success');
      } else {
        await api.post('/api/announcements', payload);
        addToast('Announcement posted successfully', 'success');
      }

      setShowForm(false);
      setEditId(null);
      fetchAnnouncements();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await api.delete(`/api/announcements/${id}`);
      addToast('Announcement deleted', 'success');
      fetchAnnouncements();
    } catch (err) {
      addToast('Failed to delete announcement', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div />

        <div className="flex gap-2">
          <button
            onClick={fetchAnnouncements}
            className="p-2.5 rounded-xl bg-[var(--bg-muted)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all shadow-sm group flex items-center justify-center"
            title="Refresh Data"
          >
            <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''} text-[var(--text-secondary)] group-hover:text-blue-500 transition-colors`} />
          </button>
          {canCreate && (
            <Button variant="primary" onClick={() => {
              setEditId(null);
              setFormData({ title: '', content: '', type: 'GENERAL', priority: 'MEDIUM', targetRole: ['all'], targetBlock: null, expiresAt: '', pinned: false });
              setShowForm(true);
            }}>
              <Plus size={18} className="mr-2" /> Post Announcement
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="input py-1.5 min-w-[150px]"
            >
              <option>All Types</option>
              {['GENERAL', 'MAINTENANCE', 'EMERGENCY', 'RESOURCE', 'EVENT'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-slate-400" />
            <select
              value={filterBlock}
              onChange={(e) => setFilterBlock(e.target.value)}
              className="input py-1.5 min-w-[150px]"
            >
              <option value="All">All Blocks</option>
              {blocks.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
            </select>
          </div>

          <div className="ml-auto text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            {announcements.length} announcement{announcements.length !== 1 ? 's' : ''}
          </div>
        </div>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-rose-200 bg-rose-50/30">
          <div className="flex items-center gap-3 text-rose-600">
            <AlertCircle size={20} />
            <span className="font-medium">{error}</span>
            <Button variant="link" size="sm" onClick={fetchAnnouncements} className="ml-auto">Retry</Button>
          </div>
        </Card>
      )}

      {/* Post Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <Card className="w-full max-w-lg shadow-2xl" title={editId ? 'Edit Announcement' : 'Post Announcement'}>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              {formError && <p className="text-rose-500 text-xs bg-rose-50 p-2 rounded border border-rose-100">{formError}</p>}

              <div>
                <label className="label mb-1.5">Announcement Title</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Water Tank Maintenance"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="label mb-1.5">Description/Content</label>
                <textarea
                  className="input min-h-[120px] resize-none"
                  placeholder="Details of the announcement..."
                  value={formData.content}
                  onChange={e => setFormData({ ...formData, content: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5">Type</label>
                  <select className="input" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })}>
                    <option>GENERAL</option>
                    <option>MAINTENANCE</option>
                    <option>EMERGENCY</option>
                    <option>RESOURCE</option>
                    <option>EVENT</option>
                  </select>
                </div>
                <div>
                  <label className="label mb-1.5">Priority</label>
                  <select className="input" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                    <option>LOW</option>
                    <option>MEDIUM</option>
                    <option>HIGH</option>
                    <option>URGENT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="label mb-1.5 flex items-center gap-2">
                    <Clock size={14} className="text-blue-500" />
                    Expiration Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    className="input w-full"
                    style={{ colorScheme: 'dark' }}
                    value={formData.expiresAt ? new Date(new Date(formData.expiresAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                    onChange={e => setFormData({ ...formData, expiresAt: e.target.value })}
                    onClick={(e) => e.target.showPicker?.()}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Notice will be automatically deleted after this time.</p>
                </div>
              </div>

              <div className="flex items-center gap-4 py-2 border-t border-[var(--border-color)]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.pinned} onChange={e => setFormData({ ...formData, pinned: e.target.checked })} className="rounded text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm font-medium">Pin to Top</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button variant="primary" type="submit" disabled={submitting}>
                  {submitting ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Plus className="mr-2" size={16} />}
                  {editId ? 'Update' : 'Post'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-48 rounded-xl animate-pulse bg-slate-100 dark:bg-slate-800" />)}
        </div>
      )}

      {/* Empty State */}
      {!loading && announcements.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <EmptyState
            icon={<Megaphone size={48} className="text-slate-300" />}
            title="No announcements yet"
            description={canCreate ? "Keep your residents updated by posting the first announcement." : "Check back later for official announcements."}
          />
          {canCreate && (
            <Button variant="primary" className="mt-6" onClick={() => setShowForm(true)}>
              Post First Announcement
            </Button>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(announcements || []).map((notice) => (
          <Card
            key={notice?._id}
            className={`group hover:shadow-lg transition-all border-l-4 ${notice.priority === 'URGENT' ? 'border-l-rose-500' :
              notice.priority === 'HIGH' ? 'border-l-orange-500' :
                notice.priority === 'MEDIUM' ? 'border-l-blue-500' : 'border-l-slate-300'
              }`}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-start justify-between mb-3">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant={
                    notice.priority === 'URGENT' ? 'danger' :
                      notice.priority === 'HIGH' ? 'warning' :
                        notice.priority === 'MEDIUM' ? 'primary' : 'default'
                  } className="px-2 py-0.5 text-[10px]">
                    {notice.priority}
                  </Badge>
                  {notice.pinned && <Badge variant="warning" className="px-2 py-0.5 text-[10px]">📌 PINNED</Badge>}
                </div>

                {canManageNotice(notice) && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditId(notice._id); setFormData(notice); setShowForm(true); }} className="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg hover:bg-blue-50">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(notice._id)} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              <h3 className="font-bold text-base mb-2 line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                {notice?.title}
              </h3>

              <p className="text-sm mb-4 line-clamp-4 flex-grow" style={{ color: 'var(--text-secondary)' }}>
                {notice?.content || notice?.description}
              </p>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 mt-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <User size={12} className="text-blue-600" />
                    </div>
                    <span className="text-[11px] font-medium truncate max-w-[80px]">
                      {notice?.createdBy?.name || 'Admin'}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[10px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar size={10} /> {timeAgo(notice?.createdAt)}
                    </span>
                    {notice?.expiresAt && (
                      <span className="flex items-center gap-1 text-rose-400/80">
                        <Clock size={10} /> Exp: {new Date(notice.expiresAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AnnouncementBoard;
