import React, { useEffect, useState, useContext, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import Loading from '../components/Loading'
import { useToast } from '../context/ToastContext'
import {
  Zap,
  Droplets,
  Sun,
  Flame,
  Wind,
  Recycle,
  Save,
  X,
  ShieldAlert,
  Activity,
  Lock,
  Settings as SettingsIcon,
  ArrowLeft,
  RefreshCw,
  BellRing,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeContext } from '../context/ThemeContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { logger } from '../utils/logger';

import { useResources } from '../hooks/useResources';

export default function AlertForm() {
  const { resources: dynamicResources } = useResources();
  const getResourceMeta = (type) => {
    const res = (dynamicResources || []).find(r => r.name === type);
    return {
      icon: (res?.icon && typeof res.icon === 'string' && res.icon.length < 5) ? <span className="text-xl">{res.icon}</span> : <Activity size={18} />,
      color: res?.color ? `text-[${res.color}]` : 'text-indigo-500',
      label: res?.name || type,
      unit: res?.unit || 'Value'
    };
  };

  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const [form, setForm] = useState({ resource_type: 'Electricity', threshold_value: '', comparison: 'gt', active: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/alerts/rules`);
      const rule = res.data.rules?.find(r => r._id === id);
      if (rule) setForm(rule);
    } catch (e) {
      logger.error('AlertForm fetchData error:', e);
      setError('Failed to load configuration sequences');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchData();
  }, [id, fetchData]);

  useEffect(() => {
    if (!id && dynamicResources?.length > 0) {
      setForm(prev => ({ ...prev, resource_type: dynamicResources[0].name }));
    }
  }, [id, dynamicResources]);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (id) await api.put(`/api/alerts/${id}`, form);
      else await api.post('/api/alerts', form);
      addToast(`Protocol ${id ? 'sequencing updated' : 'initialized'} successfully`, 'success')
      navigate('/alerts/rules')
    } catch (err) {
      setError(err.message)
      addToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Removed static getMeta helper as it is replaced by getResourceMeta above

  if (loading && !dynamicResources.length) return <div className="p-12"><Loading /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-32">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">
            <BellRing size={12} /> System Sentinel Protocol
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {id ? 'Refactor' : 'Initialize'} <span className="text-indigo-600">Sequencer</span>
          </h1>
          <p className="text-slate-500 max-w-lg">
            Automated anomaly detection for institutional grid nodes. Set threshold vectors for real-time monitoring.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/alerts/rules')} className="h-12 px-6">
          <ArrowLeft size={16} className="mr-2" /> Abort Changes
        </Button>
      </div>

      <form onSubmit={submit} className="relative group">
        <Card className="overflow-visible">
          <div className="space-y-12 p-4">
            {/* State Toggle */}
            <div className="flex flex-col md:flex-row items-center justify-between p-8 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-100 dark:border-slate-800 gap-8">
              <div className="flex items-center gap-6">
                <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-500 
                            ${form.active ? 'bg-indigo-600 text-white animate-pulse shadow-indigo-500/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                  <Activity size={32} />
                </div>
                <div>
                  <h4 className="text-xl font-bold italic uppercase tracking-tight">Sequence State</h4>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Status: {form.active ? 'OPERATIONAL' : 'DORMANT'}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setForm({ ...form, active: !form.active })}
                className={`relative inline-flex h-12 w-24 items-center rounded-full transition-all duration-500 shadow-inner
                        ${form.active ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'}`}
              >
                <div className={`transform transition-all duration-500 h-8 w-8 rounded-full bg-white shadow-xl ${form.active ? 'translate-x-14' : 'translate-x-2'}`} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                  <ShieldAlert size={14} className="text-indigo-500" /> Resource Vector
                </label>
                <div className="relative group">
                  <select
                    className="form-input h-14 pl-6 pr-12 text-sm font-bold uppercase tracking-widest cursor-pointer"
                    value={form.resource_type}
                    onChange={e => setForm({ ...form, resource_type: e.target.value })}
                  >
                    {dynamicResources?.map(res => (
                      <option key={res.name} value={res.name}>
                        {res.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-500">
                    {getResourceMeta(form.resource_type).icon}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                  <Activity size={14} className="text-indigo-500" /> Logic Gate
                </label>
                <select
                  className="form-input h-14 px-6 text-sm font-bold uppercase tracking-widest cursor-pointer"
                  value={form.comparison}
                  onChange={e => setForm({ ...form, comparison: e.target.value })}
                >
                  <option value="gt">Greater Than (&gt;)</option>
                  <option value="lt">Lower Than (&lt;)</option>
                  <option value="eq">Equal To (=)</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                  <Lock size={14} className="text-indigo-500" /> Trigger Threshold
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    className="form-input h-16 px-8 text-2xl font-black placeholder:text-slate-300 bg-slate-50/50"
                    value={form.threshold_value}
                    onChange={e => setForm({ ...form, threshold_value: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs uppercase tracking-widest">
                    Unit: {getResourceMeta(form.resource_type).unit}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 pt-10 border-t border-slate-50 dark:border-slate-800">
              <Button
                type="submit"
                variant="primary"
                className="flex-1 h-14 text-sm font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20"
                disabled={loading}
              >
                {loading ? <RefreshCw className="animate-spin mr-2" size={18} /> : <Save className="mr-2" size={18} />}
                {id ? 'Update Protocol' : 'Deploy Sequencer'}
              </Button>
            </div>
          </div>
        </Card>
      </form>

      {error && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-3xl text-rose-500 text-[10px] font-black uppercase tracking-[0.3em] text-center shadow-lg shadow-rose-500/5"
          >
            Protocol Exception: {error}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
