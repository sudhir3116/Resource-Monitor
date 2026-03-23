import React, { useEffect, useState, useContext, useMemo, useCallback } from 'react';
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
  Sun,
  Flame,
  Wind,
  Trash2,
  Calendar,
  MapPin,
  AlignLeft,
  ShieldOff,
  Lock,
  Activity,
  RefreshCw,
  Box,
  FileText
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { logger } from '../utils/logger';
import EmptyState from '../components/common/EmptyState';

const RESOURCE_META = {
  Electricity: { icon: <Zap size={20} />, color: '#f59e0b', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  Water: { icon: <Droplets size={20} />, color: '#3b82f6', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  LPG: { icon: <Flame size={20} />, color: '#f97316', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  Diesel: { icon: <Wind size={20} />, color: '#64748b', bg: 'bg-slate-50 dark:bg-slate-900/20' },
  Solar: { icon: <Sun size={20} />, color: '#eab308', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  Waste: { icon: <Trash2 size={20} />, color: '#f43f5e', bg: 'bg-rose-50 dark:bg-rose-900/20' }
};

export default function UsageForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [dynamicResources, setDynamicResources] = useState([]);

  const getLocalISOString = () => {
    const tzOffset = new Date().getTimezoneOffset() * 60000;
    return new Date(Date.now() - tzOffset).toISOString().slice(0, 16);
  };

  const isWarden = user?.role === ROLES.WARDEN;
  const wardenBlockId = user?.block?._id || user?.block || null;
  const wardenBlockName = user?.block?.name || null;
  // Role-scoped path prefix for navigation
  const usageBasePath = user?.role === 'admin' ? '/admin/usage'
    : user?.role === 'warden' ? '/warden/usage'
      : '/usage';

  const [form, setForm] = useState({
    resource_type: '',
    category: wardenBlockName || '',
    usage_value: '',
    usage_date: getLocalISOString(),
    notes: ''
  });
  const [errors, setErrors] = useState({});

  const canWrite = user && [ROLES.ADMIN, ROLES.WARDEN].includes(user.role);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, blocksRes] = await Promise.allSettled([
        api.get('/api/resource-config'),
        (!isWarden) ? api.get('/api/admin/blocks') : Promise.resolve({ status: 'rejected' })
      ]);

      if (configRes.status === 'fulfilled') {
        const configs = configRes.value.data.data || [];
        const activeResources = configs.filter(c => c.isActive);
        setDynamicResources(activeResources);

        if (!id && activeResources.length > 0) {
          setForm(f => ({ ...f, resource_type: activeResources[0].name }));
        }
      }

      if (blocksRes.status === 'fulfilled') {
        setBlocks(blocksRes.value.data.data || []);
        if (!id && !isWarden && blocksRes.value.data.data?.length > 0) {
          setForm(f => ({ ...f, category: blocksRes.value.data.data[0].name }));
        }
      }

      if (id) {
        const res = await api.get(`/api/usage/${id}`);
        const usage = res.data.usage;
        setForm({
          resource_type: usage.resource_type,
          category: usage.category || '',
          usage_value: usage.usage_value,
          usage_date: new Date(usage.usage_date).toISOString().slice(0, 16),
          notes: usage.notes || ''
        });
      }
    } catch (err) {
      logger.error('Form fetchData error:', err);
    } finally {
      setLoading(false);
    }
  }, [id, isWarden]);

  useEffect(() => {
    if (canWrite) fetchData();
  }, [fetchData, canWrite]);

  const validate = () => {
    const newErrors = {};
    if (!form.resource_type) newErrors.resource_type = 'Please select a resource.';
    if (!form.usage_value || form.usage_value <= 0) newErrors.usage_value = 'Value must be positive.';
    if (!form.usage_date) newErrors.usage_date = 'Date is required.';
    else if (new Date(form.usage_date) > new Date()) newErrors.usage_date = 'Date cannot be in the future.';
    if (isWarden && !wardenBlockId) newErrors.block = 'Assignment missing — contact Administrative HQ.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const selectedBlock = blocks.find(b => b.name === form.category);
      const payload = {
        resource_type: form.resource_type,
        usage_value: Number(form.usage_value),
        usage_date: new Date(form.usage_date),
        unit: dynamicResources.find(r => r.name === form.resource_type)?.unit || 'units',
        notes: form.notes,
      };

      if (isWarden && wardenBlockId) {
        payload.blockId = wardenBlockId;
      } else if (selectedBlock) {
        payload.blockId = selectedBlock._id;
      }

      if (id) await api.put(`/api/usage/${id}`, payload);
      else await api.post('/api/usage', payload);

      addToast(id ? 'Vector recalibrated successfully' : 'Usage sequence initialized', 'success');
      navigate(`${usageBasePath}/all`);
    } catch (err) {
      addToast(err.response?.data?.message || err.message || 'Transmission failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  const getMeta = (type) => RESOURCE_META[type] || { icon: <Activity size={20} />, color: '#64748b', bg: 'bg-slate-50' };

  if (!canWrite) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <EmptyState
          title="Unauthorized Uplink"
          description={`Your current role (${user?.role}) lacks write permissions for this sector.`}
          action={<Button onClick={() => navigate('/usage/all')} variant="secondary"><ArrowLeft className="mr-2" /> Return to Data Stream</Button>}
        />
      </div>
    );
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto py-20 flex flex-col items-center justify-center space-y-4">
      <RefreshCw className="animate-spin text-blue-600" size={40} />
      <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Initializing Secure Link...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto pb-32 pt-10 px-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="space-y-2">
          <Link to={`${usageBasePath}/all`} className="flex items-center text-xs font-bold text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 uppercase tracking-[0.2em] transition-colors mb-4 group">
            <ArrowLeft size={14} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Records
          </Link>
          <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {id ? 'Refactor' : 'Log'} <span className="text-blue-600">Resource Unit</span>
          </h1>
          <p className="text-slate-500">Record institutional consumption metrics with high-precision data entry.</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Badge variant="secondary" className="px-4 py-2 text-xs font-black uppercase tracking-wider">
            Authority: {user.role.toUpperCase()}
          </Badge>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card className="overflow-visible border-b-4 border-blue-600">
          <div className="space-y-12">

            {/* Resource Selector */}
            <div className="space-y-6">
              <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                <Box size={14} className="text-blue-600" /> Resource Vector
              </label>

              {dynamicResources.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-center text-slate-500 italic">
                  No active resource channels available. Contact System Admin to enable sensors.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {dynamicResources.map(res => {
                    const meta = getMeta(res.name);
                    const isActive = form.resource_type === res.name;
                    return (
                      <button
                        key={res._id}
                        type="button"
                        onClick={() => setForm({ ...form, resource_type: res.name })}
                        className={`group relative flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all duration-300 ${isActive
                          ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-600/10 shadow-lg shadow-blue-600/10 scale-[1.02]'
                          : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-white dark:bg-slate-900/50'
                          }`}
                      >
                        <div className={`p-4 rounded-2xl mb-4 transition-transform group-hover:scale-110 ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}>
                          {meta.icon}
                        </div>
                        <span className={`text-xs font-black uppercase tracking-widest ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
                          {res.name}
                        </span>
                        {isActive && <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-blue-600 animate-ping" />}
                      </button>
                    );
                  })}
                </div>
              )}
              {errors.resource_type && <p className="text-rose-500 text-xs font-bold pl-2">System Alert: {errors.resource_type}</p>}
            </div>

            {/* Main Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                  <Activity size={14} className="text-blue-600" /> Consumption Value
                </label>
                <div className="relative group">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className={`form-input h-16 px-8 text-2xl font-black transition-all ${errors.usage_value ? 'border-rose-500 ring-rose-500/10' : 'focus:border-blue-600 focus:ring-blue-600/10'}`}
                    value={form.usage_value}
                    onChange={e => setForm({ ...form, usage_value: e.target.value })}
                  />
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs uppercase tracking-widest pointer-events-none group-focus-within:text-blue-600 transition-colors">
                    {dynamicResources.find(r => r.name === form.resource_type)?.unit || 'units'}
                  </div>
                </div>
                {errors.usage_value && <p className="text-rose-500 text-xs font-bold pl-2">{errors.usage_value}</p>}
              </div>

              <div className="space-y-4">
                <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                  <Calendar size={14} className="text-blue-600" /> Temporal Reference
                </label>
                <input
                  type="datetime-local"
                  className={`form-input h-16 px-8 font-bold ${errors.usage_date ? 'border-rose-500' : ''}`}
                  value={form.usage_date}
                  onChange={e => setForm({ ...form, usage_date: e.target.value })}
                />
                {errors.usage_date && <p className="text-rose-500 text-xs font-bold pl-2">{errors.usage_date}</p>}
              </div>
            </div>

            {/* Location Selector */}
            <div className="space-y-4">
              <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                <MapPin size={14} className="text-blue-600" /> Deployment Sector
              </label>

              {isWarden ? (
                <div className="relative group h-16 flex items-center px-8 rounded-3xl bg-slate-50/50 dark:bg-slate-800/30 border-2 border-slate-100 dark:border-slate-800 text-slate-500 cursor-not-allowed overflow-hidden">
                  <Lock size={16} className="absolute left-6 text-slate-400" />
                  <span className="font-bold tracking-tight pl-6 flex-1">
                    {wardenBlockName || 'Unassigned — Contact Command Center'}
                  </span>
                  <Badge variant="secondary" className="bg-white/50 dark:bg-slate-800/80">FIXED SECTOR</Badge>
                  <div className="absolute bottom-0 left-0 h-[2px] bg-slate-300 dark:bg-slate-700 w-full" />
                </div>
              ) : (
                <select
                  className="form-input h-16 px-8 font-bold tracking-tight cursor-pointer"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                >
                  <option value="" disabled>Select Sector...</option>
                  {blocks.map(b => (
                    <option key={b._id} value={b.name}>{b.name}</option>
                  ))}
                  {blocks.length === 0 && (
                    <>
                      <option>Hostel Block A</option>
                      <option>Hostel Block B</option>
                      <option>Hostel Block C</option>
                      <option>Mess Hall</option>
                    </>
                  )}
                </select>
              )}
              {errors.block && <p className="text-rose-500 text-xs font-bold pl-2">{errors.block}</p>}
            </div>

            {/* Description */}
            <div className="space-y-4">
              <label className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                <AlignLeft size={14} className="text-blue-600" /> Operational Notes
              </label>
              <textarea
                rows="4"
                className="form-input p-6 text-sm font-medium leading-relaxed resize-none"
                placeholder="Enter any qualitative observations or sensor anomalies..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
        </Card>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="secondary"
            className="flex-1 h-14 font-black uppercase tracking-widest text-xs"
            onClick={() => navigate(`${usageBasePath}/all`)}
          >
            Abort Protocol
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-[2] h-14 font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-blue-600/20"
            disabled={isSubmitting || (isWarden && !wardenBlockId)}
          >
            {isSubmitting ? <RefreshCw className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
            {id ? 'Commit Unit Update' : 'Initialize Data Log'}
          </Button>
        </div>
      </form>
    </div>
  );
}
