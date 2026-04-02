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

  const [selectedResource, setSelectedResource] = useState(null)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const role = (user?.role || '').toLowerCase();
  const rawBlock = user?.block;
  const blockName = rawBlock?.name || user?.blockName || 'Your Block';

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    // Validate resource selected
    if (!selectedResource || !selectedResource._id) {
      setError('Please select a resource')
      return
    }

    // Convert amount to number for validation
    const numericAmount = Number(amount)

    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid amount greater than 0')
      return
    }

    // Validate date
    if (!date) {
      setError('Please select a date')
      return
    }

    // Build exact payload backend expects
    // Convert date to ISO format (backend requirement)
    const isoDate = new Date(date).toISOString()

    const payload = {
      resourceId: selectedResource._id,
      amount: numericAmount,
      date: isoDate,
      notes: (notes || '').trim()
    }

    console.log('PAYLOAD:', payload)

    try {
      setSubmitting(true)

      const res = await api.post('/api/usage', payload)

      if (res.data?.success || res.status === 201 || res.status === 200) {

        // Clear form
        setAmount('')
        setNotes('')
        setSelectedResource(null)
        setDate(new Date().toISOString().split('T')[0])

        // Show success
        if (typeof addToast === 'function') {
          addToast('Usage logged successfully!', 'success')
        }

        // Trigger refresh on other pages
        window.dispatchEvent(new CustomEvent('usage:added'))

        // Navigate back
        const paths = {
          admin: '/admin/usage',
          warden: '/warden/usage',
          gm: '/gm/usage'
        }
        navigate(paths[role] || '/usage')

      } else {
        setError(res.data?.message || 'Failed to save usage record')
      }
    } catch (err) {
      console.error('Usage submit error:', err)
      console.log('ERROR:', err.response?.data)

      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        (err.response?.data && typeof err.response.data === 'string' ? err.response.data : null) ||
        err.message ||
        'Failed to save usage record'

      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Route-scoped path prefix
  const usageBasePath = role === 'admin' ? '/admin/usage'
    : role === 'warden' ? '/warden/usage'
      : '/usage';

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
        {/* 1. RESOURCE SELECTION (PART 4) */}
        <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-5 shadow-sm">
          <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <LayoutGrid size={12} /> Select Resource Type *
          </label>
          <select
            className="w-full h-11 px-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-primary)] outline-none focus:border-blue-500 transition-all font-medium appearance-none cursor-pointer"
            onChange={e => {
              const selected = resources.find(r => r._id === e.target.value)
              setSelectedResource(selected || null)
              setError(null);
            }}
            value={selectedResource?._id || ''}
          >
            <option value="">-- Choose a Resource --</option>
            {resources
              .filter(r => r.status === "active" || r.isActive !== false)
              .map(r => (
                <option key={r._id} value={r._id}>
                  {r.icon || r.emoji || "📊"} {r.name} ({r.unit})
                </option>
              ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4 shadow-sm">
            <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Activity size={12} /> Usage Amount *
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setError(null);
                  if (val === "" || /^\d*\.?\d*$/.test(val)) {
                    setAmount(val);
                  }
                }}
                className="w-full h-10 px-3 pr-10 text-sm rounded-lg border border-[var(--border-color)] bg-[var(--bg-muted)] text-[var(--text-primary)] outline-none focus:border-blue-500 transition-colors"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400">
                  {selectedResource?.unit || 'units'}
                </span>
              </div>
            </div>
          </div>

          {/* 3. DATE (PART 5) */}
          <div className="bg-[var(--card-bg)] rounded-xl border border-[var(--border-color)] p-4 shadow-sm">
            <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar size={12} /> Date *
            </label>
            <input
              type="date"
              value={date}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => {
                setDate(e.target.value);
                setError(null);
              }}
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
            placeholder="Optional: add notes..."
            rows={2}
            value={notes}
            onChange={e => {
              setNotes(e.target.value);
              setError(null);
            }}
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
            disabled={submitting}
            className={`w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${!submitting
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
