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

const RESOURCE_META = {
  Electricity: { icon: <Zap size={18} />, color: 'text-amber-500', label: 'Electricity Grid' },
  Water: { icon: <Droplets size={18} />, color: 'text-blue-500', label: 'Hydraulic System' },
  LPG: { icon: <Flame size={18} />, color: 'text-orange-500', label: 'Gas Reserves' },
  Diesel: { icon: <Wind size={18} />, color: 'text-slate-500', label: 'Fuel Supply' },
  Solar: { icon: <Sun size={18} />, color: 'text-yellow-500', label: 'Solar Generation' },
  Waste: { icon: <Trash2 size={18} />, color: 'text-rose-500', label: 'Refuse Telemetry' },
};

export default function AlertForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  const [form, setForm] = useState({ resource_type: 'Electricity', threshold_value: '', comparison: 'gt', active: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dynamicResources, setDynamicResources] = useState([])

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, ruleRes] = await Promise.allSettled([
        api.get('/api/config/thresholds'),
        id ? api.get(`/api/alerts/rules`) : Promise.resolve({ status: 'rejected' })
      ]);

      if (configRes.status === 'fulfilled') {
        const resources = (configRes.value.data.data || []).filter(r => r.isActive);
        setDynamicResources(resources);
        if (!id && resources.length > 0) {
          setForm(prev => ({ ...prev, resource_type: resources[0].resource }));
        }
      }

      if (id && ruleRes.status === 'fulfilled') {
        const rule = ruleRes.value.data.rules?.find(r => r._id === id);
        if (rule) setForm(rule);
      }
    } catch (e) {
      logger.error('AlertForm fetchData error:', e);
      setError('Failed to load configuration sequences');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const getMeta = (type) => RESOURCE_META[type] || { icon: <Activity size={18} />, color: 'text-indigo-500', label: type };

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
                    {dynamicResources.map(res => (
                      <option key={res.resource} value={res.resource}>
                        {getMeta(res.resource).label}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-500">
                    {getMeta(form.resource_type).icon}
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
                    Unit: {dynamicResources.find(r => r.resource === form.resource_type)?.unit || 'Value'}
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
