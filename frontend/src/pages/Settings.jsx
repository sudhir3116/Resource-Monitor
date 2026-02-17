import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { Zap, Droplets, Flame, RefreshCw, Trash2, Edit2, Plus, Save } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import Modal, { ConfirmModal } from '../components/common/Modal';

export default function Settings() {
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [formData, setFormData] = useState({});
    const { addToast } = useToast();

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/config/thresholds');
            setConfigs(res.data.thresholds || []);
        } catch (err) {
            addToast('Failed to fetch configurations', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (formData._id) {
                await api.put(`/api/config/thresholds/${formData.resource}`, formData);
                addToast('Configuration updated successfully');
            } else {
                await api.post('/api/config/thresholds', formData);
                addToast('Configuration created successfully');
            }
            setIsModalOpen(false);
            fetchConfigs();
        } catch (err) {
            addToast('Failed to save configuration', 'error');
        }
    };

    const handleDelete = async () => {
        if (!deleteId) return;
        try {
            // Find resource name from ID
            const config = configs.find(c => c._id === deleteId);
            if (config) {
                await api.delete(`/api/config/thresholds/${config.resource}`);
                addToast('Configuration deleted successfully');
                setConfigs(configs.filter(c => c._id !== deleteId));
            }
        } catch (err) {
            addToast('Failed to delete configuration', 'error');
        } finally {
            setDeleteId(null);
        }
    };

    const openEdit = (config = {}) => {
        setFormData({
            _id: config._id || null,
            resource: config.resource || '',
            ratePerUnit: config.ratePerUnit || 0,
            dailyLimitPerPerson: config.dailyLimitPerPerson || 0,
            dailyLimitPerBlock: config.dailyLimitPerBlock || 0,
            isActive: config.isActive !== false
        });
        setIsModalOpen(true);
    };

    const getIcon = (resource) => {
        switch (resource) {
            case 'Electricity': return <Zap className="text-yellow-500" size={20} />;
            case 'Water': return <Droplets className="text-blue-500" size={20} />;
            case 'LPG': return <Flame className="text-orange-500" size={20} />;
            default: return <Zap className="text-slate-500" size={20} />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 style={{ color: 'var(--text-primary)' }}>System Configuration</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Manage resource thresholds and pricing rates
                    </p>
                </div>
                <Button variant="primary" onClick={() => openEdit()}>
                    <Plus size={16} className="mr-2" />
                    Add Configuration
                </Button>
            </div>

            {/* Configs Grid */}
            {loading ? (
                <div className="py-8 text-center text-slate-500">Loading configurations...</div>
            ) : configs.length === 0 ? (
                <EmptyState title="No Configurations" description="Add a resource configuration to get started." />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {configs.map(config => (
                        <Card key={config._id}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                                        {getIcon(config.resource)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{config.resource}</h3>
                                        <Badge variant={config.isActive ? 'success' : 'secondary'}>
                                            {config.isActive ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openEdit(config)}
                                        className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => setDeleteId(config._id)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span style={{ color: 'var(--text-secondary)' }}>Rate per Unit</span>
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>₹{config.ratePerUnit}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span style={{ color: 'var(--text-secondary)' }}>Person Limit</span>
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{config.dailyLimitPerPerson}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span style={{ color: 'var(--text-secondary)' }}>Block Limit</span>
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{config.dailyLimitPerBlock}</span>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={formData._id ? `Edit ${formData.resource}` : 'New Configuration'}
                size="md"
            >
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="label">Resource Name</label>
                        <input
                            type="text"
                            className="input"
                            value={formData.resource}
                            onChange={e => setFormData({ ...formData, resource: e.target.value })}
                            placeholder="e.g. Electricity"
                            required
                            disabled={!!formData._id}
                        />
                    </div>

                    <div>
                        <label className="label">Rate per Unit (₹)</label>
                        <input
                            type="number"
                            className="input"
                            value={formData.ratePerUnit}
                            onChange={e => setFormData({ ...formData, ratePerUnit: parseFloat(e.target.value) })}
                            required
                            min="0"
                            step="0.01"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Person Limit</label>
                            <input
                                type="number"
                                className="input"
                                value={formData.dailyLimitPerPerson}
                                onChange={e => setFormData({ ...formData, dailyLimitPerPerson: parseInt(e.target.value) })}
                                required
                                min="0"
                            />
                        </div>
                        <div>
                            <label className="label">Block Limit</label>
                            <input
                                type="number"
                                className="input"
                                value={formData.dailyLimitPerBlock}
                                onChange={e => setFormData({ ...formData, dailyLimitPerBlock: parseInt(e.target.value) })}
                                required
                                min="0"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={formData.isActive}
                            onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                        />
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Active Configuration</span>
                    </div>

                    <div className="flex justify-end pt-4 gap-3">
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="primary">Save Changes</Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Modal */}
            <ConfirmModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Delete Configuration"
                message="Are you sure you want to delete this configuration? This action cannot be undone."
            />
        </div>
    );
}
