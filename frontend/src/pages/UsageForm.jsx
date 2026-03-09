import React, { useEffect, useState, useContext } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { AuthContext } from '../context/AuthContext';
import { ROLES } from '../utils/roles';
import {
  Save,
  ArrowLeft,
  Zap,
  Droplets,
  Utensils,
  Flame,
  Wind,
  Trash2,
  Calendar,
  MapPin,
  AlignLeft,
  ShieldOff,
  Lock
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import { ThemeContext } from '../context/ThemeContext';

export default function UsageForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blocks, setBlocks] = useState([]);

  const getLocalISOString = () => {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzOffset).toISOString().slice(0, 16);
  };

  // Determine warden's block info from user session
  // user.block is populated as { _id, name } by /api/auth/me
  const isWarden = user?.role === ROLES.WARDEN;
  const wardenBlockId = user?.block?._id || user?.block || null;
  const wardenBlockName = user?.block?.name || null;

  const [form, setForm] = useState({
    resource_type: 'Electricity',
    category: wardenBlockName || 'Hostel Block A',
    usage_value: '',
    usage_date: getLocalISOString(),
    notes: ''
  });
  const [errors, setErrors] = useState({});

  // Role guard — only admin and warden can access this form
  const canWrite = user && [ROLES.ADMIN, ROLES.WARDEN].includes(user.role);
  if (!canWrite) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <div className="h-16 w-16 rounded-full bg-red-500 bg-opacity-10 flex items-center justify-center mx-auto mb-4">
          <ShieldOff size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Access Denied</h2>
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
          Only Wardens and Admins can log or edit usage records.
          Your role ({user?.role || 'unknown'}) does not have write access.
        </p>
        <Button variant="secondary" onClick={() => navigate('/usage/all')}>
          <ArrowLeft size={16} className="mr-2" /> Back to Records
        </Button>
      </div>
    );
  }

  useEffect(() => {
    if (id) load();
    // Admin fetches block list for the dropdown; wardens don't need it (auto-assigned)
    if (!isWarden) {
      api.get('/api/admin/blocks').then(r => setBlocks(r.data.data || [])).catch(() => { });
    }
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/api/usage/${id}`);
      const usage = res.data.usage;
      setForm({
        resource_type: usage.resource_type,
        category: usage.category || 'Hostel Block A',
        usage_value: usage.usage_value,
        usage_date: new Date(usage.usage_date).toISOString().slice(0, 16),
        notes: usage.notes || ''
      });
    } catch (err) {
      addToast(err.message || 'Failed to load record', 'error');
      navigate('/usage/all');
    } finally {
      setLoading(false);
    }
  }

  const validate = () => {
    const newErrors = {};
    if (!form.usage_value || form.usage_value <= 0) newErrors.usage_value = 'Value must be positive.';
    if (!form.usage_date) newErrors.usage_date = 'Date is required.';
    else if (new Date(form.usage_date) > new Date()) newErrors.usage_date = 'Date cannot be in the future.';
    // Warden must have a block assigned
    if (isWarden && !wardenBlockId) newErrors.block = 'You are not assigned to a block. Contact Admin.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Map form state fields to the API-expected field names:
      // route validator requires: resourceType, amount, date
      const payload = {
        resourceType: form.resource_type,
        amount: form.usage_value,
        date: new Date(form.usage_date),
        category: form.category,
        notes: form.notes,
      };

      // For wardens: the backend enforces blockId from their profile.
      // We also send it explicitly in the payload so it's clear in the request.
      // The backend will reject it if it doesn't match the warden's assigned block.
      if (isWarden && wardenBlockId) {
        payload.blockId = wardenBlockId;
      }

      if (id) await api.put(`/api/usage/${id}`, payload);
      else await api.post('/api/usage', payload);

      addToast(id ? 'Record updated successfully' : 'Usage logged successfully');
      navigate('/usage/all');
    } catch (err) {
      addToast(err.response?.data?.message || err.message || 'Failed to save record', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  const resources = [
    { id: 'Electricity', icon: <Zap size={20} className="text-amber-500" /> },
    { id: 'Water', icon: <Droplets size={20} className="text-blue-500" /> },
    { id: 'Food', icon: <Utensils size={20} className="text-emerald-500" /> },
    { id: 'LPG', icon: <Flame size={20} className="text-orange-500" /> },
    { id: 'Diesel', icon: <Wind size={20} className="text-slate-500" /> },
    { id: 'Waste', icon: <Trash2 size={20} className="text-rose-500" /> }
  ];

  if (loading) return <div className="p-8 text-center text-slate-500">Loading form...</div>;

  return (
    <div className="max-w-3xl mx-auto pb-20 pt-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link to="/usage/all" className="flex items-center text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 mb-2">
            <ArrowLeft size={16} className="mr-1" /> Back to List
          </Link>
          <h1 style={{ color: 'var(--text-primary)' }}>
            {id ? 'Edit Usage Record' : 'Log New Usage'}
          </h1>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Resource Type Selection */}
          <div>
            <label className="label mb-3 block">Resource Type</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {resources.map(res => (
                <button
                  key={res.id}
                  type="button"
                  onClick={() => setForm({ ...form, resource_type: res.id })}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${form.resource_type === res.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                  {res.icon}
                  <span className={`font-medium ${form.resource_type === res.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'}`}>
                    {res.id}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Value */}
            <div>
              <label className="label">Consumption Value</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className={`input ${errors.usage_value ? 'border-red-500' : ''}`}
                  value={form.usage_value}
                  onChange={e => setForm({ ...form, usage_value: e.target.value })}
                />
                {errors.usage_value && <p className="text-red-500 text-xs mt-1">{errors.usage_value}</p>}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="label">Date &amp; Time</label>
              <div className="relative">
                <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="datetime-local"
                  className={`input pl-10 ${errors.usage_date ? 'border-red-500' : ''}`}
                  value={form.usage_date}
                  onChange={e => setForm({ ...form, usage_date: e.target.value })}
                />
                {errors.usage_date && <p className="text-red-500 text-xs mt-1">{errors.usage_date}</p>}
              </div>
            </div>
          </div>

          {/* Location / Block */}
          <div>
            <label className="label">Location / Block</label>

            {isWarden ? (
              // ── WARDEN: Block is auto-assigned from their profile — cannot be changed ──
              <div>
                {errors.block && <p className="text-red-500 text-xs mb-1">{errors.block}</p>}
                <div
                  className="input pl-10 flex items-center gap-2 cursor-not-allowed opacity-75"
                  style={{ position: 'relative', backgroundColor: 'var(--bg-secondary)' }}
                  title="Your block is automatically assigned from your profile"
                >
                  <MapPin size={18} className="absolute left-3 text-slate-400" />
                  <Lock size={14} className="text-slate-400 mr-1 flex-shrink-0" style={{ marginLeft: '1.5rem' }} />
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {wardenBlockName || 'Block not assigned — contact Admin'}
                  </span>
                </div>
                <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                  <Lock size={11} />
                  Usage is automatically logged for your assigned block. Contact Admin to change your block assignment.
                </p>
              </div>
            ) : (
              // ── ADMIN: Can select any block from the list ──
              <div className="relative">
                <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                {blocks.length > 0 ? (
                  <select
                    className="input pl-10"
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                  >
                    {blocks.map(b => (
                      <option key={b._id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                ) : (
                  // Fallback static list if blocks API fails
                  <select
                    className="input pl-10"
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value })}
                  >
                    <option>Hostel Block A</option>
                    <option>Hostel Block B</option>
                    <option>Hostel Block C</option>
                    <option>Mess Hall</option>
                    <option>Common Area</option>
                    <option>Kitchen Facility</option>
                    <option>Generator Complex</option>
                  </select>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes (Optional)</label>
            <div className="relative">
              <AlignLeft size={18} className="absolute left-3 top-3 text-slate-400" />
              <textarea
                rows="3"
                className="input pl-10"
                placeholder="Additional details..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate('/usage/all')}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting || (isWarden && !wardenBlockId)}>
              {isSubmitting ? 'Saving...' : 'Save Record'}
            </Button>
          </div>

        </form>
      </Card>
    </div>
  );
}
