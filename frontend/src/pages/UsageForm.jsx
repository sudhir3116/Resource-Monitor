import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { useResources, refetchResources } from '../hooks/useResources';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Save, Activity, LayoutGrid, Calendar, FileText, MapPin, Gauge } from 'lucide-react';

const UsageForm = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { resources, loading: resourcesLoading } = useResources();

  const [formData, setFormData] = useState({
    value: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [selectedResource, setSelectedResource] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [validationError, setValidationError] = useState(null);

  const role = (user?.role || '').toLowerCase();
  const rawBlock = user?.block;
  const blockName = rawBlock?.name || user?.blockName || 'Your Block';
  const blockId = rawBlock?._id?.toString() || rawBlock?.toString() || '';

  // Route-scoped path prefix
  const usageBasePath = role === 'admin' ? '/admin/usage'
    : role === 'warden' ? '/warden/usage'
      : '/usage';

  // Validation
  const validate = () => {
    if (!selectedResource) {
      setValidationError('Please select a resource');
      return false;
    }
    if (!formData.value || Number(formData.value) <= 0) {
      setValidationError('Usage amount must be greater than 0');
      return false;
    }
    if (!formData.date) {
      setValidationError('Date is required');
      return false;
    }
    if (!blockId) {
      setValidationError('No block assigned. Contact admin.');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!validate()) return;

    const payload = {
      blockId,
      resourceId: selectedResource._id,
      usage_value: Number(formData.value),
      unit: selectedResource.unit || '',
      usage_date: formData.date || new Date().toISOString(),
      notes: formData.notes || ''
    };

    try {
      setSubmitting(true);
      setError(null);

      const res = await api.post('/api/usage', payload);

      if (res.data.success || res.status === 201) {
        // Success
        addToast('Usage logged successfully!', 'success');

        // Reset form
        setFormData({
          value: '',
          date: new Date().toISOString().split('T')[0],
          notes: ''
        });
        setSelectedResource(null);

        // Trigger global refresh
        window.dispatchEvent(
          new CustomEvent('usage:added', {
            detail: {
              resource_type: payload.resource_type,
              blockId: payload.blockId
            }
          })
        );

        // Refetch resources to ensure cache is fresh (in case admin deleted it)
        await refetchResources();

        // Navigate back
        navigate(`${usageBasePath}/all`);
      } else {
        setError(res.data.message || 'Failed to log usage');
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
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Loading Resources...</p>
      </div>
    );
  }

  // Guard against no resources
  if (resources && resources.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <Link to={`${usageBasePath}/all`} className="inline-flex items-center text-xs font-bold text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors mb-8">
          <ArrowLeft size={14} className="mr-2" /> Back
        </Link>
        <div className="card p-12 text-center">
          <p className="text-4xl mb-4">⚙️</p>
          <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>No Active Resources</p>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            An administrator must create and activate resources first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 pb-20">
      <div className="mb-6">
        <Link to={`${usageBasePath}/all`} className="inline-flex items-center text-[10px] font-bold text-slate-500 hover:text-blue-500 uppercase tracking-widest transition-colors mb-4 group">
          <ArrowLeft size={12} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Records
        </Link>
        <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Gauge className="text-blue-500" size={24} /> Log Resource Usage
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-1">Record consumption metrics for accurate system tracking.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1. RESOURCE SELECTION */}
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4 shadow-sm">
          <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <LayoutGrid size={12} /> Select Resource Type *
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {(Array.isArray(resources) ? resources : []).map(r => {
              const isSelected = selectedResource?.name === r.name;
              const resColor = r.color || '#3B82F6';
              return (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => {
                    setSelectedResource(r);
                    setValidationError(null);
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${isSelected
                    ? 'border-blue-500 bg-blue-500/5 ring-1 ring-blue-500/20 scale-105'
                    : 'border-[var(--border-color)] bg-[var(--bg-muted)]/30 hover:border-blue-500/30'
                    }`}
                >
                  <span className="text-xl">{r.icon || r.emoji || '📊'}</span>
                  <span className="text-[10px] font-bold text-[var(--text-primary)] leading-tight text-center">{r.name}</span>
                </button>
              );
            })}
          </div>
          {validationError && (
            <p className="text-[11px] text-red-500 mt-3 font-medium flex items-center gap-1">
              ⚠️ {validationError}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 2. USAGE VALUE */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4 shadow-sm">
            <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Activity size={12} /> Usage Amount *
            </label>
            <div className="relative">
              <input
                type="number"
                min="0.01"
                step="any"
                placeholder={selectedResource ? `Enter ${selectedResource.unit}` : 'Select resource'}
                disabled={!selectedResource}
                value={formData.value || ''}
                onChange={e => setFormData(p => ({ ...p, value: e.target.value }))}
                className="w-full h-10 px-3 pr-16 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-primary)] outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {selectedResource && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider pointer-events-none">
                  {selectedResource.unit}
                </span>
              )}
            </div>
          </div>

          {/* 3. DATE */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4 shadow-sm">
            <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar size={12} /> Date *
            </label>
            <input
              type="date"
              max={new Date().toISOString().split('T')[0]}
              value={formData.date || new Date().toISOString().split('T')[0]}
              onChange={e => setFormData(p => ({ ...p, date: e.target.value }))}
              className="w-full h-10 px-3 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-primary)] outline-none focus:border-blue-500 transition-colors cursor-pointer"
            />
          </div>
        </div>

        {/* 4. BLOCK INFO (READ-ONLY) */}
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4 shadow-sm">
          <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            <MapPin size={12} className="inline mr-1" /> Assigned Block (Auto)
          </label>
          <div className="w-full h-10 px-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)]/50 text-[var(--text-secondary)] text-sm flex items-center gap-2 cursor-not-allowed">
            <span className="opacity-70">🏢</span> {blockName}
          </div>
        </div>

        {/* 5. NOTES */}
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4 shadow-sm">
          <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            <FileText size={12} className="inline mr-1" /> Additional Notes
          </label>
          <textarea
            placeholder="Optional: add notes or observations..."
            rows={2}
            value={formData.notes || ''}
            onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
            className="w-full p-3 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-primary)] outline-none focus:border-blue-500 transition-colors resize-none"
          />
        </div>

        {/* ERROR DISPLAY */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
            ⚠️ {error}
          </div>
        )}

        {/* SUBMIT BUTTON */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting || !selectedResource || !formData.value || Number(formData.value) <= 0}
            className={`w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${selectedResource && formData.value && Number(formData.value) > 0 && !submitting
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 active:scale-[0.98]'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
          >
            {submitting ? (
              <>
                <Activity size={16} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save size={16} /> Log Usage Data
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default UsageForm;
