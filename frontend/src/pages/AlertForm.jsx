import React, { useEffect, useState, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import Loading from '../components/Loading'
import { useToast } from '../context/ToastContext'
import {
  Zap,
  Droplets,
  Utensils,
  Flame,
  Fuel,
  Recycle,
  Save,
  X,
  ShieldAlert,
  Activity,
  Lock,
  Settings as SettingsIcon,
  ArrowLeft
} from 'lucide-react';
import { motion } from 'framer-motion';
import { ThemeContext } from '../context/ThemeContext';

export default function AlertForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { darkMode } = useContext(ThemeContext);

  const [form, setForm] = useState({ resource_type: 'Electricity', threshold_value: '', comparison: 'gt', active: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { if (id) load() }, [id])
  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/api/alerts/rules`);
      const rule = res.data.rules.find(r => r._id === id);
      if (rule) setForm(rule)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      if (id) await api.put(`/api/alerts/${id}`, form);
      else await api.post('/api/alerts', form);
      addToast(`Protocol ${id ? 'sequencing updated' : 'initialized'} successfully`)
      navigate('/alerts/rules')
    } catch (err) {
      setError(err.message)
      addToast(err.message, 'error')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-fade-in font-['Outfit']">
      <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
          <h1 className="text-5xl font-black text-slate-900 dark:text-slate-50 tracking-tightest uppercase border-l-8 border-indigo-600 pl-8">
            {id ? 'Update' : 'Init'} <span className="text-indigo-600 dark:text-indigo-400">Protocol</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-4 text-xl font-bold max-w-xl italic leading-relaxed">
            Configure automated anomaly detection sequences for institutional grid nodes.
          </p>
        </div>
        <button onClick={() => navigate('/alerts/rules')} className="flex items-center gap-3 text-slate-400 hover:text-indigo-600 font-black text-[10px] uppercase tracking-[0.4em] transition-all group">
          <ArrowLeft size={16} className="group-hover:-translate-x-2 transition-transform" /> Cancel Operation
        </button>
      </div>

      {loading ? <Loading /> : (
        <form onSubmit={submit} className="bg-white dark:bg-slate-800 rounded-[56px] border border-slate-100 dark:border-white/5 shadow-3xl dark:shadow-none overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />

          <div className="p-12 md:p-16 space-y-12 relative z-10">
            {/* Status Integration */}
            <div className="flex flex-col md:flex-row items-center justify-between p-8 bg-slate-50 dark:bg-slate-900/50 rounded-[32px] border border-slate-100 dark:border-white/5 gap-8">
              <div className="flex items-center gap-6">
                <div className={`h-16 w-16 rounded-[24px] flex items-center justify-center shadow-2xl transition-all
                  ${form.active ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                  <Activity size={32} strokeWidth={2.5} />
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900 dark:text-white italic uppercase tracking-tightest">Sequence State</h4>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Rule operational parameters</p>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] ml-4 flex items-center gap-3">
                  <ShieldAlert size={14} className="text-indigo-500" /> Resource Vector
                </label>
                <div className="relative group">
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-white/5 rounded-[24px] px-8 py-5 text-sm font-black text-slate-900 dark:text-white outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none uppercase tracking-widest"
                    value={form.resource_type}
                    onChange={e => setForm({ ...form, resource_type: e.target.value })}
                  >
                    <option value="Electricity">Electricity Sequence</option>
                    <option value="Water">Water Sequence</option>
                    <option value="Food">Food Waste Grid</option>
                    <option value="LPG">Gas Distribution</option>
                    <option value="Diesel">Diesel Reserves</option>
                    <option value="Waste">Waste Telemetry</option>
                  </select>
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-indigo-500 transition-colors">
                    <SettingsIcon size={18} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] ml-4 flex items-center gap-3">
                  <Zap size={14} className="text-indigo-500" /> Comparison Protocol
                </label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-white/5 rounded-[24px] px-8 py-5 text-sm font-black text-slate-900 dark:text-white outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none uppercase tracking-widest"
                  value={form.comparison}
                  onChange={e => setForm({ ...form, comparison: e.target.value })}
                >
                  <option value="gt">Exceeds Threshold (&gt;)</option>
                  <option value="lt">Below Threshold (&lt;)</option>
                  <option value="eq">Exact Match (=)</option>
                </select>
              </div>

              <div className="space-y-4 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.4em] ml-4 flex items-center gap-3">
                  <Lock size={14} className="text-indigo-500" /> Threshold Trigger Value
                </label>
                <input
                  type="number"
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-white/5 rounded-[24px] px-8 py-5 text-xl font-black text-slate-900 dark:text-white outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
                  value={form.threshold_value}
                  onChange={e => setForm({ ...form, threshold_value: e.target.value })}
                  placeholder="Enter limit value (e.g. 500)"
                  required
                />
              </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-rose-500/10 border border-rose-500/20 rounded-[28px] text-rose-500 text-xs font-black uppercase tracking-widest text-center shadow-lg shadow-rose-500/10 mb-8">
                Security Error: {error}
              </motion.div>
            )}

            <div className="flex flex-col md:flex-row gap-6 pt-12 border-t border-slate-50 dark:border-white/5">
              <button
                type="button"
                className="flex-1 py-6 rounded-[28px] border-2 border-slate-100 dark:border-white/5 text-slate-400 dark:text-slate-500 font-black text-xs uppercase tracking-[0.4em] hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-95"
                onClick={() => navigate('/alerts/rules')}
              >
                Abort Changes
              </button>
              <button
                type="submit"
                className="flex-1 py-6 bg-indigo-600 text-white rounded-[28px] font-black text-xs uppercase tracking-[0.4em] shadow-3xl shadow-indigo-600/30 hover:bg-indigo-500 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4"
              >
                <Save size={18} strokeWidth={3} /> {id ? 'Update Protocol' : 'Initialize Rule'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
