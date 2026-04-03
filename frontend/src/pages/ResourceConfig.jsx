import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../utils/roles';
import { logger } from '../utils/logger';
import { useToast } from '../context/ToastContext';
import { refetchResources } from '../hooks/useResources';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { ConfirmModal } from '../components/common/Modal';
import {
    Zap, Droplets, Flame, Wind, Sun, Trash2,
    ShieldOff, Save, RefreshCw, Plus, X, ChevronDown,
    ChevronUp, AlertTriangle, CheckCircle, Settings2,
    Building2, ToggleLeft, ToggleRight, Edit3, Clock,
    DollarSign, TrendingUp, Activity,
} from 'lucide-react';
import useSortableTable from '../hooks/useSortableTable';
import SortIcon from '../components/common/SortIcon';
import { motion, AnimatePresence } from 'framer-motion';


const renderIcon = (emoji, color = '#3B82F6') => {
    if (!emoji) return <Activity size={16} />;
    if (typeof emoji === 'string' && emoji.length <= 4) return <span className="text-lg leading-none" style={{ color }}>{emoji}</span>;
    return <Activity size={16} style={{ color }} />;
};

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
function ResourceRow({ config, isAdmin, isGM, onSave, onToggle, onDelete }) {
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState({});
    const [errors, setErrors] = useState({});
    const { addToast } = useToast();

    /* No static metadata used here anymore — all dynamic */

    /* Build initial draft values (always as numbers) */
    const initialDraft = useCallback(() => ({
        costPerUnit: Number(config.costPerUnit) || 0,
        dailyLimit: Number(config.dailyThreshold) || 0,
        monthlyLimit: Number(config.monthlyThreshold) || 0,
        unit: config.unit || '',
        emoji: config.icon || '📊',
        color: config.color || '#3B82F6',
    }), [config]);

    /* Dirty check — compare to original values */
    const hasChanges = editing && (
        Number(draft.costPerUnit) !== Number(config.costPerUnit) ||
        Number(draft.dailyLimit) !== Number(config.dailyThreshold) ||
        Number(draft.monthlyLimit) !== Number(config.monthlyThreshold) ||
        draft.unit !== config.unit ||
        draft.emoji !== config.icon ||
        draft.color !== config.color
    );

    const startEdit = () => { setDraft(initialDraft()); setErrors({}); setEditing(true); };
    const cancelEdit = () => { setEditing(false); setErrors({}); };

    const validate = () => {
        const e = {};
        if (Number(draft.costPerUnit) < 0) e.costPerUnit = 'Must be ≥ 0';
        if (Number(draft.dailyLimit) <= 0) e.dailyLimit = 'Must be > 0';
        if (Number(draft.monthlyLimit) <= 0) e.monthlyLimit = 'Must be > 0';
        if (Number(draft.dailyLimit) > Number(draft.monthlyLimit))
            e.dailyLimit = 'Daily cannot exceed monthly';
        if (!draft.unit.trim()) e.unit = 'Required';
        if (!draft.emoji.trim()) e.emoji = 'Required';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setSaving(true);
        try {
            await onSave(config._id, {
                name: config.name,
                rate: Number(draft.costPerUnit),
                dailyLimit: Number(draft.dailyLimit),
                monthlyLimit: Number(draft.monthlyLimit),
                unit: draft.unit,
                icon: draft.emoji,
                color: draft.color
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
                            style={{ backgroundColor: (config.color || '#64748b') + '20' }}
                        >
                            {renderIcon(config.icon, config.color)}
                        </span>
                        <div>
                            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                                {config.name}
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
                    <Badge variant={(config.status === 'active' || config.isActive) ? 'success' : 'danger'}>
                        {(config.status === 'active' || config.isActive) ? 'ACTIVE' : 'INACTIVE'}
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
                    {(isAdmin || isGM) && (
                        <div className="flex items-center gap-1.5">
                            <Button size="sm" variant="secondary" onClick={startEdit}>
                                <Edit3 size={13} className="mr-1" />
                                Edit
                            </Button>
                            <button
                                onClick={() => onToggle(config._id, config.name, (config.status === 'active' || config.isActive))}
                                title={(config.status === 'active' || config.isActive) ? 'Deactivate' : 'Activate'}
                                className={`flex items-center justify-center px-2 py-1 rounded-lg transition-colors text-xs font-medium border ${(config.status === 'active' || config.isActive)
                                    ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-900/50'
                                    : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-900/50'
                                    }`}
                            >
                                {(config.status === 'active' || config.isActive) ? 'Deactivate' : 'Activate'}
                            </button>
                            {isAdmin && (
                                <button
                                    onClick={() => onDelete(config._id)}
                                    title="Delete Permanently"
                                    className="flex items-center justify-center h-7 w-7 rounded-lg transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 group"
                                    style={{ backgroundColor: 'var(--bg-hover)' }}
                                >
                                    <Trash2 size={13} className="text-slate-400 group-hover:text-red-500" />
                                </button>
                            )}
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
                    <div className="flex flex-col gap-1">
                        <input
                            type="text"
                            placeholder="Emoji"
                            value={draft.emoji}
                            onChange={e => setDraft(p => ({ ...p, emoji: e.target.value }))}
                            className="input text-xs p-1 h-7 w-12 text-center"
                            disabled={!isAdmin}
                        />
                        <input
                            type="color"
                            value={draft.color}
                            onChange={e => setDraft(p => ({ ...p, color: e.target.value }))}
                            className="h-6 w-12 p-0 border-0 bg-transparent cursor-pointer"
                            disabled={!isAdmin}
                        />
                    </div>
                    <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                            {config.name}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-primary)' }}>Editing</p>
                    </div>
                </div>
            </td>

            {/* Unit */}
            <td>
                <div className="flex flex-col gap-0.5">
                    <input
                        type="text"
                        placeholder="e.g. kWh"
                        className={`input text-sm py-1.5 ${errors.unit ? 'border-red-500' : ''}`}
                        style={{ width: 110 }}
                        value={draft.unit}
                        onChange={e => setDraft(p => ({ ...p, unit: e.target.value }))}
                        disabled={!isAdmin}
                    />
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
                    value={draft.dailyLimit}
                    min="0.01"
                    step="0.01"
                    error={errors.dailyLimit}
                    onChange={e => setDraft(p => ({ ...p, dailyLimit: e.target.value }))}
                />
            </td>

            {/* Monthly Limit */}
            <td>
                <InlineNumberInput
                    value={draft.monthlyLimit}
                    min="0.01"
                    step="0.01"
                    error={errors.monthlyLimit}
                    onChange={e => setDraft(p => ({ ...p, monthlyLimit: e.target.value }))}
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
            await refetchResources();
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
                <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-5">
                    <div>
                        <label className="form-label">Target Resource</label>
                        <select className={`form-input h-12 ${errors.resource ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'}`}
                            value={form.resource} onChange={e => setForm(p => ({ ...p, resource: e.target.value }))}>
                            <option value="">Select resource…</option>
                            {resources.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
                        </select>
                        {errors.resource && <p className="text-red-500 text-[10px] font-bold uppercase mt-2 ml-1">{errors.resource}</p>}
                    </div>
                    <div>
                        <label className="form-label">Target Block</label>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <select className={`form-input pl-10 h-12 ${errors.blockId ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'}`}
                                value={form.blockId} onChange={e => setForm(p => ({ ...p, blockId: e.target.value }))}>
                                <option value="">Select block…</option>
                                {blocks.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                            </select>
                        </div>
                        {errors.blockId && <p className="text-red-500 text-[10px] font-bold uppercase mt-2 ml-1">{errors.blockId}</p>}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="form-label">Daily Override</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="Inherit global"
                                className={`form-input h-12 ${errors.dailyThreshold ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'}`}
                                value={form.dailyThreshold}
                                onChange={e => setForm(p => ({ ...p, dailyThreshold: e.target.value }))}
                            />
                            {errors.dailyThreshold && <p className="text-red-500 text-[10px] font-bold uppercase mt-2 ml-1">{errors.dailyThreshold}</p>}
                        </div>
                        <div>
                            <label className="form-label">Monthly Limit Override</label>
                            <input type="number" min="0" placeholder="Inherit global"
                                className={`form-input h-12 ${errors.monthlyThreshold ? 'border-red-500' : 'border-slate-200 dark:border-slate-800'}`}
                                value={form.monthlyThreshold}
                                onChange={e => setForm(p => ({ ...p, monthlyThreshold: e.target.value }))} />
                            {errors.monthlyThreshold && <p className="text-red-500 text-[10px] font-bold uppercase mt-2 ml-1">{errors.monthlyThreshold}</p>}
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                        Notice: Leave blank to inherit the global limit for that resource.
                    </p>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
                        <Button type="submit" variant="primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Set Override'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Add New Resource Modal ─────────────────────────────────────────────────── */
function AddResourceModal({ isOpen, onClose, existingResources, onSave }) {
    const { addToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    const initialForm = {
        name: '', unit: '', rate: '', dailyLimit: '', monthlyLimit: '',
        emoji: '📊', color: '#3B82F6'
    };
    const [form, setForm] = useState(initialForm);

    useEffect(() => {
        if (isOpen) {
            setForm(initialForm);
            setErrors({});
        }
    }, [isOpen]);

    const validateForm = () => {
        let e = {};
        if (!form.name?.trim()) e.name = "Name required";
        if (!form.unit?.trim()) e.unit = "Unit required";

        if (form.rate < 0) e.rate = "Invalid rate";
        if (form.dailyLimit < 0) e.dailyLimit = "Invalid daily limit";
        if (form.monthlyLimit < 0) e.monthlyLimit = "Invalid monthly limit";

        if (Number(form.dailyLimit) > Number(form.monthlyLimit)) {
            e.dailyLimit = "Daily budget exceeds monthly";
        }

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!validateForm() || saving) return;

        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                unit: form.unit.trim(),
                rate: Number(form.rate),
                dailyLimit: Number(form.dailyLimit),
                monthlyLimit: Number(form.monthlyLimit),
                icon: form.emoji || '📊',
                color: form.color || '#3B82F6'
            };

            await api.post('/api/resources', payload);
            addToast(`"${form.name}" created successfully`, 'success');

            if (typeof refetchResources === 'function') await refetchResources();
            await onSave();
            onClose();
        } catch (err) {
            console.error(err);
            addToast(err.response?.data?.message || err.message || 'Failed to create resource', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-md bg-white dark:bg-[#0f172a] rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Add Resource</h3>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Resource Name */}
                    <div>
                        <label className="text-sm text-gray-400 mb-1 block">Resource Name</label>
                        <input
                            type="text"
                            autoFocus
                            placeholder="Resource name"
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            className={`input-field w-full rounded-lg border p-2.5 text-sm outline-none transition-all ${errors.name ? 'border-red-500' : 'border-slate-200 dark:border-slate-800 dark:bg-slate-900'}`}
                        />
                        {errors.name && <p className="error-text text-red-500 text-xs mt-1">{errors.name}</p>}
                    </div>

                    {/* Emoji & Color (Grid) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Emoji</label>
                            <input
                                type="text"
                                placeholder="📊"
                                value={form.emoji}
                                maxLength={4}
                                onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))}
                                className="input-field w-full rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-900 p-2.5 text-sm text-center outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block">Color</label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={form.color}
                                    onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                                    className="h-10 w-12 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 cursor-pointer overflow-hidden"
                                />
                                <input
                                    type="text"
                                    value={form.color}
                                    onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                                    className="input-field flex-1 rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-900 p-2 text-xs font-mono outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Unit */}
                    <div>
                        <label className="text-sm text-gray-400 mb-1 block">Unit</label>
                        <input
                            type="text"
                            placeholder="e.g. kWh"
                            value={form.unit}
                            onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                            className={`input-field w-full rounded-lg border p-2.5 text-sm outline-none ${errors.unit ? 'border-red-500' : 'border-slate-200 dark:border-slate-800 dark:bg-slate-900'}`}
                        />
                        {errors.unit && <p className="error-text text-red-500 text-xs mt-1">{errors.unit}</p>}
                    </div>

                    {/* Rate, Daily, Monthly */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block text-[11px]">Rate</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.rate}
                                onChange={e => setForm(p => ({ ...p, rate: e.target.value }))}
                                className={`input-field w-full rounded-lg border p-2 text-sm outline-none ${errors.rate ? 'border-red-500' : 'border-slate-200 dark:border-slate-800 dark:bg-slate-900'}`}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block text-[11px]">Daily Limit</label>
                            <input
                                type="number"
                                min="0"
                                value={form.dailyLimit}
                                onChange={e => setForm(p => ({ ...p, dailyLimit: e.target.value }))}
                                className={`input-field w-full rounded-lg border p-2 text-sm outline-none ${errors.dailyLimit ? 'border-red-500' : 'border-slate-200 dark:border-slate-800 dark:bg-slate-900'}`}
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-400 mb-1 block text-[11px]">Monthly Limit</label>
                            <input
                                type="number"
                                min="0"
                                value={form.monthlyLimit}
                                onChange={e => setForm(p => ({ ...p, monthlyLimit: e.target.value }))}
                                className={`input-field w-full rounded-lg border p-2 text-sm outline-none ${errors.monthlyLimit ? 'border-red-500' : 'border-slate-200 dark:border-slate-800 dark:bg-slate-900'}`}
                            />
                        </div>
                    </div>
                    {(errors.rate || errors.dailyLimit || errors.monthlyLimit) && <p className="error-text text-red-500 text-[10px] text-center">Invalid limits or rate</p>}

                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/10 transition-all disabled:opacity-50 flex items-center gap-2 primary-btn"
                        >
                            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                            {saving ? 'Creating...' : 'Create Resource'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Main Page ──────────────────────────────────────────────────────────────── */
export default function ResourceConfig({ isGM: isGMProp = false }) {
    const { user } = useAuth();
    const { addToast } = useToast();

    const [configs, setConfigs] = useState([]);
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [toggleTarget, setToggleTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [showBlockOverrides, setShowBlockOverrides] = useState(false);

    const isAdmin = user?.role === 'admin';
    const isGM = isGMProp || user?.role === 'gm';
    // GM can manage values (edit/toggle) but not create/delete resource objects.
    const canManageResources = ['admin', 'gm'].includes(user?.role) || isGM;
    const isWarden = user?.role === 'warden';
    const canView = canManageResources || isGM || isWarden;

    const { sortedData: sortedConfigs, sortField, sortDirection, handleSort } = useSortableTable(
        configs,
        'resource',
        [configs]
    );

    /* ── Fetch configs ──────────────────────────────────────────────────── */
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [cfgRes, blkRes] = await Promise.all([
                api.get('/api/resources'),
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
                    Only Administrators and GMs can access Resource Configuration.
                    Your role ({user?.role || 'unknown'}) does not have access.
                </p>
            </div>
        );
    }

    /* ── Save handler ───────────────────────────────────────────────────── */
    const handleSaveResource = async (id, draft) => {
        try {
            const res = await api.put(`/api/resources/${id}`, draft);
            addToast(`Resource updated successfully`, 'success');
            if (typeof refetchResources === 'function') await refetchResources();
            await fetchData(); // refresh from backend
        } catch (err) {
            logger.error(`[ResourceConfig] Save failed for ${resource}:`, err);
            addToast(err.message || `Failed to save ${resource}`, 'error');
            throw err; // re-throw so the row knows save failed
        }
    };

    /* ── Toggle handler ─────────────────────────────────────────────────── */
    const handleToggle = (id, name, isActive) => setToggleTarget({ id, name, isActive });
    const confirmToggle = async () => {
        if (!toggleTarget) return;
        try {
            await api.patch(`/api/resources/${toggleTarget.id}/toggle`);
            addToast('Resource status updated', 'success');
            await refetchResources();
            await fetchData();
        } catch (err) {
            logger.error('Toggle error:', err);
            addToast(err.message || 'Failed to update status', 'error');
        } finally {
            setToggleTarget(null);
        }
    };

    /* ── Delete handlers ────────────────────────────────────────────────── */
    const handleDeleteResource = (id) => {
        setDeleteTarget({ type: 'resource', resource: id });
    };

    const handleDeleteOverride = (resource, blockId, blockName) => {
        setDeleteTarget({ type: 'override', resource, blockId, blockName });
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            if (deleteTarget.type === 'resource') {
                await api.delete(`/api/resources/${deleteTarget.resource}`);
                addToast(`Resource deleted successfully`, 'success');
                await refetchResources();
            } else {
                await api.delete(`/api/config/thresholds/${deleteTarget.resource}/block-override/${deleteTarget.blockId}`);
                addToast(`Override for ${deleteTarget.blockName} removed`, 'success');
            }
            await fetchData();
        } catch (err) {
            logger.error('Delete error:', err);
            addToast(err.message || 'Failed to delete', 'error');
        } finally {
            setDeleteTarget(null);
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
                <div />

                {canManageResources && (
                    <div className="flex gap-3 items-center flex-shrink-0">
                        <button
                            onClick={fetchData}
                            className="p-2.5 rounded-xl bg-[var(--bg-muted)] hover:bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all shadow-sm group flex items-center justify-center"
                            title="Refresh Data"
                        >
                            <RefreshCw size={18} className={`${loading ? 'animate-spin' : ''} text-[var(--text-secondary)] group-hover:text-blue-500 transition-colors`} />
                        </button>
                        <Button variant="secondary" onClick={() => setShowOverrideModal(true)}>
                            <Building2 size={16} className="mr-2" /> Block Override
                        </Button>
                        {!isGM && (
                            <Button variant="primary" onClick={() => setShowAddModal(true)}>
                                <Plus size={16} className="mr-2" /> Add Resource
                            </Button>
                        )}
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
            {isWarden && !canManageResources && (
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
                title="Settings"
            >
                {/* Edit mode hint */}
                {canManageResources && !loading && configs.length > 0 && (
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
                                <th style={{ width: 160 }} onClick={() => handleSort('resource')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'resource' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                    Resource <SortIcon field="resource" sortField={sortField} sortDirection={sortDirection} />
                                </th>
                                <th style={{ width: 110 }} onClick={() => handleSort('unit')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'unit' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                    Unit <SortIcon field="unit" sortField={sortField} sortDirection={sortDirection} />
                                </th>
                                <th style={{ width: 130 }} onClick={() => handleSort('costPerUnit')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'costPerUnit' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                    <span className="flex items-center gap-1">
                                        <DollarSign size={13} />
                                        Cost / Unit <SortIcon field="costPerUnit" sortField={sortField} sortDirection={sortDirection} />
                                    </span>
                                </th>
                                <th style={{ width: 130 }} onClick={() => handleSort('dailyThreshold')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'dailyThreshold' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                    <span className="flex items-center gap-1">
                                        <TrendingUp size={13} />
                                        Daily Limit <SortIcon field="dailyThreshold" sortField={sortField} sortDirection={sortDirection} />
                                    </span>
                                </th>
                                <th style={{ width: 140 }} onClick={() => handleSort('monthlyThreshold')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'monthlyThreshold' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                    <span className="flex items-center gap-1">
                                        <Activity size={13} />
                                        Monthly Limit <SortIcon field="monthlyThreshold" sortField={sortField} sortDirection={sortDirection} />
                                    </span>
                                </th>
                                <th style={{ width: 100 }} onClick={() => handleSort('isActive')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'isActive' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                    Status <SortIcon field="isActive" sortField={sortField} sortDirection={sortDirection} />
                                </th>
                                <th style={{ width: 120 }} onClick={() => handleSort('updatedBy.name')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'updatedBy.name' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                    Updated By <SortIcon field="updatedBy.name" sortField={sortField} sortDirection={sortDirection} />
                                </th>
                                <th style={{ width: 120 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && configs.length === 0 ? <SkeletonRows /> :
                                sortedConfigs.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="py-10">
                                            <EmptyState
                                                title="No resource configurations"
                                                description={canManageResources
                                                    ? "Click 'Add Resource' to create the first configuration."
                                                    : "No configurations have been set up yet."}
                                            />
                                        </td>
                                    </tr>
                                ) : (
                                    sortedConfigs.map(config => (
                                        <ResourceRow
                                            key={config.name}
                                            config={config}
                                            isAdmin={canManageResources}
                                            isGM={isGM}
                                            onSave={handleSaveResource}
                                            onToggle={handleToggle}
                                            onDelete={handleDeleteResource}
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
                                    {canManageResources && <th>Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {configs.flatMap(config => {
                                    const overrides = config.blockOverrides instanceof Map
                                        ? [...config.blockOverrides.entries()]
                                        : Object.entries(config.blockOverrides || {});
                                    return overrides.map(([blockId, ov]) => (
                                        <tr key={`${config.name}-${blockId}`} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="font-medium text-slate-700 dark:text-slate-300">{ov.blockName || blockId}</td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    {renderIcon(config.icon, config.color)}
                                                    <span className="text-sm font-medium">{config.name}</span>
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
                                            {canManageResources && (
                                                <td>
                                                    <button
                                                        onClick={() => handleDeleteOverride(config.name, blockId, ov.blockName || blockId)}
                                                        className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 group/delbtn"
                                                        title="Remove Override"
                                                    >
                                                        <Trash2 size={14} className="text-slate-400 group-hover/delbtn:text-red-500" />
                                                    </button>
                                                </td>
                                            )}
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
                title={toggleTarget?.isActive ? 'Deactivate Resource' : 'Activate Resource'}
                message={toggleTarget
                    ? !toggleTarget.isActive
                        ? `Enable tracking and alerts for ${toggleTarget.name}? It will be visible across dashboards.`
                        : `Deactivate ${toggleTarget.name}? Usage can still be logged but alerts for this resource may be disabled.`
                    : ''}
                confirmText={toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
                type={toggleTarget?.isActive ? 'danger' : 'primary'}
            />

            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={confirmDelete}
                title={deleteTarget?.type === 'resource' ? 'Delete Resource' : 'Remove Block Override'}
                message={deleteTarget?.type === 'resource'
                    ? `This will permanently delete this resource from the system.`
                    : `Are you sure you want to remove the override for ${deleteTarget?.resource} on ${deleteTarget?.blockName}? This block will revert to using the global threshold settings.`}
                confirmText={deleteTarget?.type === 'resource' ? "Delete Permanently" : "Remove Override"}
                type="danger"
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
