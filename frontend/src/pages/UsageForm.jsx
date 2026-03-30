import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import useResources from '../hooks/useResources';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Save, Activity, LayoutGrid, Calendar, FileText, MapPin, Gauge } from 'lucide-react';

const UsageForm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { resources, loading: resourcesLoading } = useResources();

  const [formData, setFormData] = useState({
    value: '',
    date: new Date().toISOString().split('T', 1)[0],
    notes: ''
  });
  const [selectedResource, setSelectedResource] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isWarden = user?.role === 'warden';
  const role = (user?.role || '').toLowerCase();
  const rawBlock = user?.block;
  const blockName = rawBlock?.name || 'Your Block';
  const blockId = rawBlock?._id?.toString() || rawBlock?.toString() || '';

  // Route-scoped path prefix for navigation
  const usageBasePath = role === 'admin' ? '/admin/usage'
    : role === 'warden' ? '/warden/usage'
      : '/usage';

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    const payload = {
      blockId,
      resource: selectedResource?._id, // Add ID for new schema
      resource_type: selectedResource?.name,
      usage_value: Number(formData.value),
      unit: selectedResource?.unit || '',
      usage_date: formData.date || new Date().toISOString(),
      notes: formData.notes || ''
    };

    // Validate before sending
    if (!payload.blockId) {
      setError('No block assigned to your account. Contact Admin HQ.');
      return;
    }
    if (!payload.resource_type) {
      setError('Please select a resource type.');
      return;
    }
    if (!payload.usage_value || payload.usage_value <= 0) {
      setError('Enter a valid consumption value greater than 0.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await api.post('/api/usage', payload);

      if (res.data.success || res.status === 201) {
        // Clear form
        setFormData({
          value: '',
          date: new Date().toISOString().split('T', 1)[0],
          notes: ''
        });
        setSelectedResource(null);

        // Show success toast
        if (typeof addToast === 'function') {
          addToast('Usage logged successfully!', 'success');
        }

        // Trigger refresh across all pages via globally recognized event
        window.dispatchEvent(
          new CustomEvent('usage:added', {
            detail: {
              resource_type: payload.resource_type,
              blockId: payload.blockId
            }
          })
        );

        // Navigate back to usage list based on role
        const paths = {
          admin: '/admin/usage',
          warden: '/warden/usage',
          gm: '/gm/usage'
        };
        navigate(paths[role] || '/usage/all');
      } else {
        setError(res.data.message || 'Transmission failed. Data not saved.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to connect to server';
      setError(msg);
      console.error('UsageForm submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (resourcesLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <Activity className="animate-spin text-blue-600" size={32} />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Initializing Link...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <Link to={`${usageBasePath}/all`} className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors mb-4 group">
          <ArrowLeft size={14} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Records List
        </Link>
        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
          <Gauge className="text-blue-600" /> Log Consumption
        </h1>
        <p className="text-slate-500 mt-2">Enter latest resource metrics for accurate system analytics.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Resource Selection */}
        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-xl backdrop-blur-md">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 mb-8">
            <LayoutGrid size={14} className="text-blue-500" /> 01. SECURE CHANNEL SELECTION
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {resources.map(r => (
              <button
                key={r.name}
                type="button"
                onClick={() => {
                  setSelectedResource(r);
                  setError(null);
                }}
                className={`group flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden ${selectedResource?.name === r.name
                  ? 'border-blue-500 bg-blue-600/10 shadow-[0_0_20px_rgba(59,130,246,0.2)] scale-105 z-10'
                  : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                  }`}
              >
                {selectedResource?.name === r.name && (
                  <div className="absolute top-0 right-0 p-1 bg-blue-500 rounded-bl-lg">
                    <Save size={10} className="text-white" />
                  </div>
                )}
                <span className={`text-4xl mb-3 transition-transform duration-300 group-hover:scale-110 ${selectedResource?.name === r.name ? 'grayscale-0' : 'grayscale'}`}>
                  {r.icon || '📊'}
                </span>
                <span className={`text-[10px] font-black uppercase tracking-widest text-center transition-colors ${selectedResource?.name === r.name ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  {r.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 2. Consumption Value */}
          <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-lg backdrop-blur-md">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 mb-6">
              <Activity size={14} className="text-blue-500" /> 02. METRIC QUANTITY
            </label>
            <div className="relative group">
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={formData.value}
                onChange={e => setFormData(p => ({ ...p, value: e.target.value }))}
                className="w-full h-16 px-6 text-3xl font-black rounded-xl bg-slate-900 text-white border-2 border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none placeholder:text-slate-700"
                required
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                  {selectedResource?.unit || 'units'}
                </span>
              </div>
            </div>
            <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {selectedResource ? `Recording ${selectedResource.name} intake` : 'Select a resource to proceed'}
            </p>
          </div>

          {/* 3. Date Selection */}
          <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-lg backdrop-blur-md">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 mb-6">
              <Calendar size={14} className="text-blue-500" /> 03. LOG PERIOD
            </label>
            <input
              type="date"
              value={formData.date}
              max={new Date().toISOString().split('T', 1)[0]}
              onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
              className="w-full h-16 px-6 text-xl font-bold rounded-xl bg-slate-900 text-white border-2 border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none cursor-pointer appearance-none"
            />
          </div>
        </div>

        {/* 4. Block Info */}
        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-lg backdrop-blur-md">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 mb-6">
            <MapPin size={14} className="text-blue-500" /> 04. SECTOR IDENTIFICATION
          </label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 p-6 bg-slate-900 rounded-2xl border border-slate-800">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-blue-600/10 flex items-center justify-center border border-blue-500/20 shadow-inner">
                <LayoutGrid className="text-blue-500" size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-0.5">Deployment Sector</p>
                <p className="text-xl font-bold text-white">{blockName}</p>
              </div>
            </div>
            <div className="sm:ml-auto">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 rounded-full border border-slate-700">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                  {isWarden ? 'Auto-Assigned HQ' : 'System Context'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 5. Notes */}
        <div className="bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-lg backdrop-blur-md">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-2 mb-6">
            <FileText size={14} className="text-blue-500" /> 05. CORE OBSERVATIONS
          </label>
          <textarea
            rows="3"
            placeholder="Log entries, anomaly reports, or sensor diagnostics..."
            value={formData.notes}
            onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
            className="w-full p-6 text-sm font-medium rounded-xl bg-slate-900 text-white border-2 border-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none resize-none placeholder:text-slate-700"
          />
        </div>

        {error && (
          <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-500 text-sm font-bold flex items-center gap-4 animate-in slide-in-from-top-4">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center shrink-0">
              <Activity size={18} />
            </div>
            <p className="uppercase tracking-wide leading-tight">Critical Warning: {error}</p>
          </div>
        )}

        <div className="pt-6">
          <button
            type="submit"
            disabled={submitting || !selectedResource || !formData.value}
            className={`w-full h-20 rounded-2xl text-xs font-black uppercase tracking-[0.3em] shadow-2xl transition-all active:scale-[0.97] flex items-center justify-center gap-4 ${submitting || !selectedResource || !formData.value
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 border-b-4 border-blue-800'
              }`}
          >
            {submitting ? (
              <>
                <Activity className="animate-spin" size={20} /> SYNCING LOGGED DATA...
              </>
            ) : (
              <>
                <Save size={20} /> COMMIT LOG ENTRY
              </>
            )}
          </button>
          <div className="flex items-center justify-center gap-4 mt-8">
            <div className="h-px w-10 bg-slate-800" />
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em]">
              Integrity protocol active • Secure Uplink
            </p>
            <div className="h-px w-10 bg-slate-800" />
          </div>
        </div>
      </form>
    </div>
  );
};

export default UsageForm;
