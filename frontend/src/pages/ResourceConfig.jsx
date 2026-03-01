import React, { useEffect, useState, useContext, useCallback, useRef } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { ROLES } from '../utils/roles';
import { logger } from '../utils/logger';
import { useToast } from '../context/ToastContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { ConfirmModal } from '../components/common/Modal';
import {
    Zap, Droplets, Flame, Wind, Utensils, Trash2,
    ShieldOff, Save, RefreshCw, Plus, X, ChevronDown,
    ChevronUp, AlertTriangle, CheckCircle, Settings2,
    Building2, ToggleLeft, ToggleRight, Edit3, Clock,
    DollarSign, TrendingUp, Activity,
} from 'lucide-react';

/* ─── Resource meta ──────────────────────────────────────────────────────────── */
const RESOURCE_META = {
    Electricity: { icon: <Zap size={16} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    Water: { icon: <Droplets size={16} />, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
    LPG: { icon: <Flame size={16} />, color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
    Diesel: { icon: <Wind size={16} />, color: '#64748b', bg: 'rgba(100,116,139,0.12)' },
    Food: { icon: <Utensils size={16} />, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    Waste: { icon: <Trash2 size={16} />, color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
};

const ALL_RESOURCES = ['Electricity', 'Water', 'LPG', 'Diesel', 'Food', 'Waste'];
const UNIT_OPTIONS = ['kWh', 'Liters', 'kg', 'units', 'meals', 'cubic meters'];

/* ─── Helpers ─────────────────────────────────────────────────────────────────── */
const fmt = (n, decimals = 2) =>
    n != null ? Number(n).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : '—';

const fmtCurrency = (n) =>
    n != null ? `₹\u00a0${fmt(n)}` : '—';

const fmtQty = (n, unit) =>
    n != null ? `${fmt(n, 0)} ${unit || ''}` : '—';

const fmtDate = (d) => {
    if (!d) return '—';
    return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }).format(new Date(d));
};

/* ─── Tooltip ────────────────────────────────────────────────────────────────── */
function Tooltip({ children, text }) {
    const [visible, setVisible] = useState(false);
    return (
        <span
            className="relative inline-flex items-center"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            {children}
            {visible && (
                <span
                    className="absolute bottom-full left-1/2 z-50 mb-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium pointer-events-none"
                    style={{
                        transform: 'translateX(-50%)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-lg)',
                    }}
                >
                    {text}
                    <span
                        className="absolute top-full left-1/2"
                        style={{
                            transform: 'translateX(-50%)',
                            borderWidth: '4px',
                            borderStyle: 'solid',
                            borderColor: 'var(--border) transparent transparent transparent',
                        }}
                    />
                </span>
            )}
        </span>
    );
}

/* ─── Inline number input ────────────────────────────────────────────────────── */
function InlineNumberInput({ value, onChange, error, min = '0', step = '0.01', style = {} }) {
    return (
        <div className="flex flex-col gap-0.5">
            <input
                type="number"
                min={min}
                step={step}
                value={value}
                onChange={onChange}
                className={`input text-sm py-1.5 ${error ? 'border-red-500' : ''}`}
                style={{ width: 110, ...style }}
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
    );
}

/* ─── Resource Row (table row with inline edit) ──────────────────────────────── */
function ResourceRow({ config, isAdmin, onSave, onToggle }) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState({});
    const [errors, setErrors] = useState({});
    const { addToast } = useToast();

    const meta = RESOURCE_META[config.resource] || { color: '#64748b', bg: 'rgba(100,116,139,0.1)' };

    /* Build initial draft values (always as numbers) */
    const initialDraft = useCallback(() => ({
        costPerUnit: Number(config.costPerUnit) || 0,
        dailyThreshold: Number(config.dailyThreshold) || 0,
        monthlyThreshold: Number(config.monthlyThreshold) || 0,
        unit: config.unit || '',
    }), [config]);

    /* Dirty check — compare to original values */
    const hasChanges = editing && (
        Number(draft.costPerUnit) !== Number(config.costPerUnit) ||
        Number(draft.dailyThreshold) !== Number(config.dailyThreshold) ||
        Number(draft.monthlyThreshold) !== Number(config.monthlyThreshold) ||
        draft.unit !== config.unit
    );

    const startEdit = () => { setDraft(initialDraft()); setErrors({}); setEditing(true); };
    const cancelEdit = () => { setEditing(false); setErrors({}); };

    const validate = () => {
        const e = {};
        if (Number(draft.costPerUnit) < 0) e.costPerUnit = 'Must be ≥ 0';
        if (Number(draft.dailyThreshold) <= 0) e.dailyThreshold = 'Must be > 0';
        if (Number(draft.monthlyThreshold) <= 0) e.monthlyThreshold = 'Must be > 0';
        if (Number(draft.dailyThreshold) > Number(draft.monthlyThreshold))
            e.dailyThreshold = 'Daily cannot exceed monthly';
        if (!draft.unit.trim()) e.unit = 'Required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            await onSave(config.resource, {
                costPerUnit: Number(draft.costPerUnit),
                dailyThreshold: Number(draft.dailyThreshold),
                monthlyThreshold: Number(draft.monthlyThreshold),
                unit: draft.unit,
            });
            setEditing(false);
        } catch {
            /* error toast already shown by parent */
        } finally {
            setSaving(false);
        }
    };

    /* ── View mode row ──────────────────────────────────────────────────── */
    if (!editing) {
        return (
            <tr
                style={{
                    transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
            >
                {/* Resource */}
                <td>
                    <div className="flex items-center gap-2.5">
                        <span
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0"
                            style={{ background: meta.bg, color: meta.color }}
                        >
                            {meta.icon}
                        </span>
                        <div>
                            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                                {config.resource}
                            </p>
                        </div>
                    </div>
                </td>

                {/* Unit */}
                <td>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        {config.unit || '—'}
                    </span>
                </td>

                {/* Cost / Unit */}
                <td>
                    <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {fmtCurrency(config.costPerUnit)}
                        {config.unit ? <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>/{config.unit}</span> : null}
                    </span>
                </td>

                {/* Daily Limit */}
                <td>
                    <span className="text-sm tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {fmtQty(config.dailyThreshold, config.unit)}
                    </span>
                </td>

                {/* Monthly Limit */}
                <td>
                    <span className="text-sm tabular-nums" style={{ color: 'var(--text-primary)' }}>
                        {fmtQty(config.monthlyThreshold, config.unit)}
                    </span>
                </td>

                {/* Status */}
                <td>
                    <Badge variant={config.isActive ? 'success' : 'danger'}>
                        {config.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                </td>

                {/* Updated By */}
                <td>
                    <Tooltip text={`Last updated: ${fmtDate(config.updatedAt)}`}>
                        <span
                            className="text-xs flex items-center gap-1 cursor-default"
                            style={{ color: 'var(--text-secondary)' }}
                        >
                            <Clock size={11} />
                            {config.updatedBy?.name || 'System'}
                        </span>
                    </Tooltip>
                </td>

                {/* Actions */}
                <td>
                    {isAdmin && (
                        <div className="flex items-center gap-1.5">
                            <Button size="sm" variant="secondary" onClick={startEdit}>
                                <Edit3 size={13} className="mr-1" />
                                Edit
                            </Button>
                            <button
                                onClick={() => onToggle(config.resource, !config.isActive)}
                                title={config.isActive ? 'Deactivate' : 'Activate'}
                                className="flex items-center justify-center h-7 w-7 rounded-lg transition-colors"
                                style={{ backgroundColor: 'var(--bg-hover)' }}
                            >
                                {config.isActive
                                    ? <ToggleRight size={16} className="text-green-500" />
                                    : <ToggleLeft size={16} className="text-slate-400" />}
                            </button>
                        </div>
                    )}
                </td>
            </tr>
        );
    }

    /* ── Edit mode row ──────────────────────────────────────────────────── */
    return (
        <tr style={{ backgroundColor: 'var(--color-primary)' + '08', outline: '2px solid var(--color-primary)', outlineOffset: '-1px' }}>
            {/* Resource (not editable) */}
            <td>
                <div className="flex items-center gap-2.5">
                    <span
                        className="inline-flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0"
                        style={{ background: meta.bg, color: meta.color }}
                    >
                        {meta.icon}
                    </span>
                    <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                            {config.resource}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-primary)' }}>Editing</p>
                    </div>
                </div>
            </td>

            {/* Unit */}
            <td>
                <div className="flex flex-col gap-0.5">
                    <select
                        className={`input text-sm py-1.5 ${errors.unit ? 'border-red-500' : ''}`}
                        style={{ width: 110 }}
                        value={draft.unit}
                        onChange={e => setDraft(p => ({ ...p, unit: e.target.value }))}
                    >
                        {UNIT_OPTIONS.map(u => (
                            <option key={u} value={u}>{u}</option>
                        ))}
                        {/* add current value if not in list */}
                        {draft.unit && !UNIT_OPTIONS.includes(draft.unit) && (
                            <option value={draft.unit}>{draft.unit}</option>
                        )}
                    </select>
                    {errors.unit && <p className="text-red-400 text-xs">{errors.unit}</p>}
                </div>
            </td>

            {/* Cost / Unit */}
            <td>
                <InlineNumberInput
                    value={draft.costPerUnit}
                    min="0"
                    step="0.01"
                    error={errors.costPerUnit}
                    onChange={e => setDraft(p => ({ ...p, costPerUnit: e.target.value }))}
                />
            </td>

            {/* Daily Limit */}
            <td>
                <InlineNumberInput
                    value={draft.dailyThreshold}
                    min="0.01"
                    step="0.01"
                    error={errors.dailyThreshold}
                    onChange={e => setDraft(p => ({ ...p, dailyThreshold: e.target.value }))}
                />
            </td>

            {/* Monthly Limit */}
            <td>
                <InlineNumberInput
                    value={draft.monthlyThreshold}
                    min="0.01"
                    step="0.01"
                    error={errors.monthlyThreshold}
                    onChange={e => setDraft(p => ({ ...p, monthlyThreshold: e.target.value }))}
                />
            </td>

            {/* Status */}
            <td>
                <Badge variant={config.isActive ? 'success' : 'danger'}>
                    {config.isActive ? 'Active' : 'Inactive'}
                </Badge>
            </td>

            {/* Updated By */}
            <td>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
            </td>

            {/* Actions */}
            <td>
                <div className="flex items-center gap-1.5">
                    <Button
                        size="sm"
                        variant="primary"
                        disabled={!hasChanges || saving}
                        onClick={handleSave}
                    >
                        {saving
                            ? <RefreshCw size={13} className="animate-spin mr-1" />
                            : <Save size={13} className="mr-1" />}
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={cancelEdit} disabled={saving}>
                        <X size={13} />
                    </Button>
                </div>
            </td>
        </tr>
    );
}

/* ─── Block Override Modal ───────────────────────────────────────────────────── */
function BlockOverrideModal({ isOpen, onClose, resources, blocks, onSave }) {
    const [form, setForm] = useState({ resource: '', blockId: '', dailyThreshold: '', monthlyThreshold: '' });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const { addToast } = useToast();

    const validate = () => {
        const e = {};
        if (!form.resource) e.resource = 'Select a resource';
        if (!form.blockId) e.blockId = 'Select a block';
        if (form.dailyThreshold && Number(form.dailyThreshold) < 0) e.dailyThreshold = 'Must be ≥ 0';
        if (form.monthlyThreshold && Number(form.monthlyThreshold) < 0) e.monthlyThreshold = 'Must be ≥ 0';
        if (form.dailyThreshold && form.monthlyThreshold &&
            Number(form.dailyThreshold) > Number(form.monthlyThreshold))
            e.dailyThreshold = 'Daily cannot exceed monthly';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            const payload = {};
            if (form.dailyThreshold) payload.dailyThreshold = Number(form.dailyThreshold);
            if (form.monthlyThreshold) payload.monthlyThreshold = Number(form.monthlyThreshold);
            await api.put(`/api/config/thresholds/${form.resource}/block-override/${form.blockId}`, payload);
            addToast(`Block override set for ${form.resource}`, 'success');
            onSave();
            onClose();
            setForm({ resource: '', blockId: '', dailyThreshold: '', monthlyThreshold: '' });
        } catch (err) {
            logger.error('BlockOverrideModal save error:', err);
            addToast(err.message || 'Failed to set override', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose} />
            <div className="relative w-full max-w-md rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', boxShadow: 'var(--shadow-lg)' }}>
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-semibold text-lg flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Building2 size={18} className="text-blue-500" /> Add Block Override
                    </h3>
                    <button onClick={onClose} className="p-1 rounded" style={{ color: 'var(--text-secondary)' }}><X size={18} /></button>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="form-label">Resource</label>
                        <select className={`form-input ${errors.resource ? 'border-red-500' : ''}`}
                            value={form.resource} onChange={e => setForm(p => ({ ...p, resource: e.target.value }))}>
                            <option value="">Select resource…</option>
                            {resources.map(r => <option key={r.resource} value={r.resource}>{r.resource}</option>)}
                        </select>
                        {errors.resource && <p className="text-red-500 text-xs mt-1">{errors.resource}</p>}
                    </div>
                    <div>
                        <label className="form-label">Block</label>
                        <select className={`form-input ${errors.blockId ? 'border-red-500' : ''}`}
                            value={form.blockId} onChange={e => setForm(p => ({ ...p, blockId: e.target.value }))}>
                            <option value="">Select block…</option>
                            {blocks.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                        </select>
                        {errors.blockId && <p className="text-red-500 text-xs mt-1">{errors.blockId}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="form-label">Daily Override</label>
                            <input type="number" min="0" placeholder="Leave blank = inherit"
                                className={`form-input ${errors.dailyThreshold ? 'border-red-500' : ''}`}
                                value={form.dailyThreshold}
                                onChange={e => setForm(p => ({ ...p, dailyThreshold: e.target.value }))} />
                            {errors.dailyThreshold && <p className="text-red-500 text-xs mt-1">{errors.dailyThreshold}</p>}
                        </div>
                        <div>
                            <label className="form-label">Monthly Override</label>
                            <input type="number" min="0" placeholder="Leave blank = inherit"
                                className={`form-input ${errors.monthlyThreshold ? 'border-red-500' : ''}`}
                                value={form.monthlyThreshold}
                                onChange={e => setForm(p => ({ ...p, monthlyThreshold: e.target.value }))} />
                            {errors.monthlyThreshold && <p className="text-red-500 text-xs mt-1">{errors.monthlyThreshold}</p>}
                        </div>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        Leave blank to inherit the global threshold for that resource.
                    </p>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button variant="primary" onClick={handleSubmit} disabled={saving}>
                        {saving ? <RefreshCw size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
                        {saving ? 'Saving…' : 'Set Override'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

/* ─── Add New Resource Modal ─────────────────────────────────────────────────── */
function AddResourceModal({ isOpen, onClose, existingResources, onSave }) {
    const [form, setForm] = useState({
        resource: '', unit: 'kWh', costPerUnit: '', dailyThreshold: '', monthlyThreshold: ''
    });
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const { addToast } = useToast();

    const available = ALL_RESOURCES.filter(r => !existingResources.includes(r));

    const validate = () => {
        const e = {};
        if (!form.resource) e.resource = 'Select a resource';
        if (!form.unit.trim()) e.unit = 'Required';
        if (form.costPerUnit === '' || Number(form.costPerUnit) < 0) e.costPerUnit = 'Must be ≥ 0';
        if (!form.dailyThreshold || Number(form.dailyThreshold) <= 0) e.dailyThreshold = 'Must be > 0';
        if (!form.monthlyThreshold || Number(form.monthlyThreshold) <= 0) e.monthlyThreshold = 'Must be > 0';
        if (Number(form.dailyThreshold) > Number(form.monthlyThreshold))
            e.dailyThreshold = 'Daily cannot exceed monthly';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            await api.post('/api/config/thresholds', {
                resource: form.resource,
                unit: form.unit,
                costPerUnit: Number(form.costPerUnit),
                dailyThreshold: Number(form.dailyThreshold),
                monthlyThreshold: Number(form.monthlyThreshold),
            });
            addToast(`${form.resource} configuration created`, 'success');
            onSave();
            onClose();
            setForm({ resource: '', unit: 'kWh', costPerUnit: '', dailyThreshold: '', monthlyThreshold: '' });
        } catch (err) {
            logger.error('AddResourceModal save error:', err);
            addToast(err.message || 'Failed to create resource', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose} />
            <div className="relative w-full max-w-md rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', boxShadow: 'var(--shadow-lg)' }}>
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-semibold text-lg flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Plus size={18} className="text-blue-500" /> Add Resource Configuration
                    </h3>
                    <button onClick={onClose} className="p-1 rounded" style={{ color: 'var(--text-secondary)' }}><X size={18} /></button>
                </div>
                {available.length === 0 ? (
                    <div className="text-center py-6">
                        <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
                        <p style={{ color: 'var(--text-secondary)' }}>All resources are already configured.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="form-label">Resource</label>
                            <select className={`form-input ${errors.resource ? 'border-red-500' : ''}`}
                                value={form.resource} onChange={e => setForm(p => ({ ...p, resource: e.target.value }))}>
                                <option value="">Select resource…</option>
                                {available.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            {errors.resource && <p className="text-red-500 text-xs mt-1">{errors.resource}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="form-label">Unit</label>
                                <select className={`form-input ${errors.unit ? 'border-red-500' : ''}`}
                                    value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}>
                                    {UNIT_OPTIONS.map(u => <option key={u}>{u}</option>)}
                                </select>
                                {errors.unit && <p className="text-red-500 text-xs mt-1">{errors.unit}</p>}
                            </div>
                            <div>
                                <label className="form-label">Cost per unit (₹)</label>
                                <input type="number" min="0" step="0.01" placeholder="0.00"
                                    className={`form-input ${errors.costPerUnit ? 'border-red-500' : ''}`}
                                    value={form.costPerUnit}
                                    onChange={e => setForm(p => ({ ...p, costPerUnit: e.target.value }))} />
                                {errors.costPerUnit && <p className="text-red-500 text-xs mt-1">{errors.costPerUnit}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="form-label">Daily Threshold</label>
                                <input type="number" min="0.01" placeholder="e.g. 50"
                                    className={`form-input ${errors.dailyThreshold ? 'border-red-500' : ''}`}
                                    value={form.dailyThreshold}
                                    onChange={e => setForm(p => ({ ...p, dailyThreshold: e.target.value }))} />
                                {errors.dailyThreshold && <p className="text-red-500 text-xs mt-1">{errors.dailyThreshold}</p>}
                            </div>
                            <div>
                                <label className="form-label">Monthly Threshold</label>
                                <input type="number" min="0.01" placeholder="e.g. 1500"
                                    className={`form-input ${errors.monthlyThreshold ? 'border-red-500' : ''}`}
                                    value={form.monthlyThreshold}
                                    onChange={e => setForm(p => ({ ...p, monthlyThreshold: e.target.value }))} />
                                {errors.monthlyThreshold && <p className="text-red-500 text-xs mt-1">{errors.monthlyThreshold}</p>}
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                    {available.length > 0 && (
                        <Button variant="primary" onClick={handleSubmit} disabled={saving}>
                            {saving ? <RefreshCw size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
                            {saving ? 'Creating…' : 'Create'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
export default function ResourceConfig() {
    const { user } = useContext(AuthContext);
    const { addToast } = useToast();

    const [configs, setConfigs] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [toggleTarget, setToggleTarget] = useState(null);
    const [showBlockOverrides, setShowBlockOverrides] = useState(false);

    const isAdmin = user?.role === ROLES.ADMIN;
    const isWarden = user?.role === ROLES.WARDEN;
    const canView = isAdmin || isWarden;

    /* ── Fetch configs ──────────────────────────────────────────────────── */
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [cfgRes, blkRes] = await Promise.all([
                api.get('/api/config/thresholds'),
                api.get('/api/config/blocks').catch(() => ({ data: { data: [] } })),
            ]);
            setConfigs(cfgRes.data.data || []);
            setBlocks(blkRes.data.data || []);
        } catch (err) {
            logger.error('ResourceConfig fetchData error:', err);
            addToast(err.message || 'Failed to load configurations', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    /* ── Role guard ─────────────────────────────────────────────────────── */
    if (!canView) {
        return (
            <div className="max-w-xl mx-auto py-20 text-center">
                <div className="h-16 w-16 rounded-full bg-red-500 bg-opacity-10 flex items-center justify-center mx-auto mb-4">
                    <ShieldOff size={32} className="text-red-500" />
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Access Denied</h2>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Only Administrators can access Resource Configuration.
                    Your role ({user?.role || 'unknown'}) does not have access.
                </p>
            </div>
        );
    }

    /* ── Save handler ───────────────────────────────────────────────────── */
    const handleSaveResource = async (resource, draft) => {
        try {
            logger.log(`[ResourceConfig] Saving ${resource}:`, draft);
            const res = await api.put(`/api/config/thresholds/${resource}`, draft);
            logger.log(`[ResourceConfig] Save response for ${resource}:`, res.data);
            addToast(`${resource} configuration updated successfully`, 'success');
            await fetchData(); // refresh from backend
        } catch (err) {
            logger.error(`[ResourceConfig] Save failed for ${resource}:`, err);
            addToast(err.message || `Failed to save ${resource}`, 'error');
            throw err; // re-throw so the row knows save failed
        }
    };

    /* ── Toggle handler ─────────────────────────────────────────────────── */
    const handleToggle = (resource, isActive) => setToggleTarget({ resource, isActive });
    const confirmToggle = async () => {
        if (!toggleTarget) return;
        try {
            await api.put(`/api/config/thresholds/${toggleTarget.resource}`, { isActive: toggleTarget.isActive });
            addToast(
                `${toggleTarget.resource} ${toggleTarget.isActive ? 'activated' : 'deactivated'}`,
                'success'
            );
            await fetchData();
        } catch (err) {
            logger.error('Toggle error:', err);
            addToast(err.message || 'Failed to update status', 'error');
        } finally {
            setToggleTarget(null);
        }
    };

    /* ── Derived stats ──────────────────────────────────────────────────── */
    const activeCount = configs.filter(c => c.isActive).length;
    const inactiveCount = configs.length - activeCount;
    const totalOverrides = configs.reduce((acc, c) => {
        const map = c.blockOverrides instanceof Map
            ? c.blockOverrides
            : new Map(Object.entries(c.blockOverrides || {}));
        return acc + map.size;
    }, 0);

    /* ── Skeleton loader ────────────────────────────────────────────────── */
    const SkeletonRows = () => (
        <>
            {[1, 2, 3, 4].map(i => (
                <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                        <td key={j}>
                            <div className="h-5 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-hover)', width: j === 0 ? 120 : 80 }} />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );

    return (
        <div className="space-y-6">
            {/* ── Page Header ───────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 style={{ color: 'var(--text-primary)' }}>Resource Configuration</h1>
                    <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Manage thresholds, cost rates, and block-level overrides for all monitored resources
                    </p>
                </div>
                {isAdmin && (
                    <div className="flex gap-2 flex-shrink-0">
                        <Button variant="secondary" onClick={() => setShowOverrideModal(true)}>
                            <Building2 size={16} className="mr-2" /> Block Override
                        </Button>
                        <Button variant="primary" onClick={() => setShowAddModal(true)}>
                            <Plus size={16} className="mr-2" /> Add Resource
                        </Button>
                    </div>
                )}
            </div>

            {/* ── Summary Stats ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<Settings2 size={18} />} label="Total Resources" value={configs.length} color="blue" />
                <StatCard icon={<CheckCircle size={18} />} label="Active" value={activeCount} color="green" />
                <StatCard icon={<AlertTriangle size={18} />} label="Inactive" value={inactiveCount} color="amber" />
                <StatCard icon={<Building2 size={18} />} label="Block Overrides" value={totalOverrides} color="purple" />
            </div>

            {/* ── Warden note ───────────────────────────────────────────── */}
            {isWarden && !isAdmin && (
                <div className="flex items-start gap-3 rounded-lg p-4 border"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
                    <AlertTriangle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        You are viewing resource configurations in <strong>read-only</strong> mode. Only Administrators can modify thresholds.
                    </p>
                </div>
            )}

            {/* ── Configs Table ─────────────────────────────────────────── */}
            <Card
                title="Resource Settings"
                description={isAdmin ? 'Click Edit on any row to modify thresholds and cost rates inline.' : 'Read-only view of all resource configurations.'}
            >
                {/* Edit mode hint */}
                {isAdmin && !loading && configs.length > 0 && (
                    <div
                        className="flex items-center gap-2 mb-4 rounded-lg px-3 py-2 text-xs"
                        style={{ backgroundColor: 'var(--color-primary)' + '10', color: 'var(--color-primary)', border: '1px solid var(--color-primary)' + '30' }}
                    >
                        <Edit3 size={12} />
                        Click the <strong>Edit</strong> button on any row to modify values inline. The Save button activates only when you change a value.
                    </div>
                )}

                <div className="overflow-x-auto -mx-2">
                    <table className="table w-full" style={{ minWidth: 800 }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                <th style={{ width: 160 }}>Resource</th>
                                <th style={{ width: 110 }}>Unit</th>
                                <th style={{ width: 130 }}>
                                    <span className="flex items-center gap-1">
                                        <DollarSign size={13} />
                                        Cost / Unit
                                    </span>
                                </th>
                                <th style={{ width: 130 }}>
                                    <span className="flex items-center gap-1">
                                        <TrendingUp size={13} />
                                        Daily Limit
                                    </span>
                                </th>
                                <th style={{ width: 140 }}>
                                    <span className="flex items-center gap-1">
                                        <Activity size={13} />
                                        Monthly Limit
                                    </span>
                                </th>
                                <th style={{ width: 90 }}>Status</th>
                                <th style={{ width: 120 }}>Updated By</th>
                                <th style={{ width: 140 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <SkeletonRows />
                            ) : configs.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-10">
                                        <EmptyState
                                            title="No resource configurations"
                                            description={isAdmin
                                                ? "Click 'Add Resource' to create the first configuration."
                                                : "No configurations have been set up yet."}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                configs.map(config => (
                                    <ResourceRow
                                        key={config.resource}
                                        config={config}
                                        isAdmin={isAdmin}
                                        onSave={handleSaveResource}
                                        onToggle={handleToggle}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* ── Block Overrides Table ──────────────────────────────────── */}
            {totalOverrides > 0 && (
                <Card title="Block-Level Threshold Overrides" description="These blocks have custom thresholds that override the global defaults">
                    <div className="overflow-x-auto">
                        <table className="table w-full">
                            <thead>
                                <tr>
                                    <th>Block</th>
                                    <th>Resource</th>
                                    <th>Daily Override</th>
                                    <th>Monthly Override</th>
                                    <th>Global Default (Daily)</th>
                                    <th>Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                {configs.flatMap(config => {
                                    const overrides = config.blockOverrides instanceof Map
                                        ? [...config.blockOverrides.entries()]
                                        : Object.entries(config.blockOverrides || {});
                                    return overrides.map(([blockId, ov]) => (
                                        <tr key={`${config.resource}-${blockId}`}>
                                            <td className="font-medium">{ov.blockName || blockId}</td>
                                            <td>
                                                <div className="flex items-center gap-2" style={{ color: RESOURCE_META[config.resource]?.color }}>
                                                    {RESOURCE_META[config.resource]?.icon}
                                                    <span className="text-sm">{config.resource}</span>
                                                </div>
                                            </td>
                                            <td className="tabular-nums">
                                                {ov.dailyThreshold != null
                                                    ? `${fmt(ov.dailyThreshold, 0)} ${config.unit}`
                                                    : <span className="italic text-slate-400">inherited</span>}
                                            </td>
                                            <td className="tabular-nums">
                                                {ov.monthlyThreshold != null
                                                    ? `${fmt(ov.monthlyThreshold, 0)} ${config.unit}`
                                                    : <span className="italic text-slate-400">inherited</span>}
                                            </td>
                                            <td className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                                                {fmtQty(config.dailyThreshold, config.unit)}
                                            </td>
                                            <td><Badge variant="warning">Override</Badge></td>
                                        </tr>
                                    ));
                                })}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* ── Modals ────────────────────────────────────────────────── */}
            <AddResourceModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                existingResources={configs.map(c => c.resource)}
                onSave={fetchData}
            />

            <BlockOverrideModal
                isOpen={showOverrideModal}
                onClose={() => setShowOverrideModal(false)}
                resources={configs}
                blocks={blocks}
                onSave={fetchData}
            />

            <ConfirmModal
                isOpen={!!toggleTarget}
                onClose={() => setToggleTarget(null)}
                onConfirm={confirmToggle}
                title={toggleTarget?.isActive ? 'Activate Resource' : 'Deactivate Resource'}
                message={toggleTarget
                    ? toggleTarget.isActive
                        ? `Enable tracking and alerts for ${toggleTarget.resource}? It will be visible across dashboards.`
                        : `Deactivate ${toggleTarget.resource}? Usage can still be logged but alerts will be disabled.`
                    : ''}
                confirmText={toggleTarget?.isActive ? 'Activate' : 'Deactivate'}
                type={toggleTarget?.isActive ? 'primary' : 'danger'}
            />
        </div>
    );
}

/* ─── Stat Card ──────────────────────────────────────────────────────────────── */
function StatCard({ icon, label, value, color }) {
    const colorMap = {
        blue: { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6' },
        green: { bg: 'rgba(16,185,129,0.1)', text: '#10b981' },
        amber: { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b' },
        purple: { bg: 'rgba(139,92,246,0.1)', text: '#8b5cf6' },
    };
    const c = colorMap[color] || colorMap.blue;
    return (
        <div className="card">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</p>
                </div>
                <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: c.bg, color: c.text }}
                >
                    {icon}
                </div>
            </div>
        </div>
    );
}
