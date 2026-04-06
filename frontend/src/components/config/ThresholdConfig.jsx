import React, { useState, useEffect, useContext } from 'react';
import api from '../../api';
import { AuthContext } from '../../context/AuthContext';
import Loading from '../Loading';
import { toast } from 'react-hot-toast';
import useSortableTable from '../../hooks/useSortableTable';
import SortIcon from '../common/SortIcon';

export default function ThresholdConfig() {
    const { user } = useContext(AuthContext);
    const [thresholds, setThresholds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingResource, setEditingResource] = useState(null);
    const [formData, setFormData] = useState({});
    const [saving, setSaving] = useState(false);

    const { sortedData: sortedThresholds, sortField, sortDirection, handleSort } = useSortableTable(
        thresholds,
        'resource',
        [thresholds]
    );

    useEffect(() => {
        fetchThresholds();
    }, []);

    const fetchThresholds = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.get('/api/config/thresholds');
            // Support both old and new formats for safety
            setThresholds(response.data.data || response.data.thresholds || []);
        } catch (err) {
            console.error('Fetch thresholds error:', err);
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load thresholds');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (threshold) => {
        setEditingResource(threshold.resource);
        setFormData({
            dailyLimitPerPerson: threshold.dailyLimitPerPerson || 0,
            dailyLimitPerBlock: threshold.dailyLimitPerBlock || 0,
            monthlyLimitPerPerson: threshold.monthlyLimitPerPerson || 0,
            monthlyLimitPerBlock: threshold.monthlyLimitPerBlock || 0,
            rate: threshold.rate || 0,
            unit: threshold.unit || ''
        });
    };

    const handleCancel = () => {
        setEditingResource(null);
        setFormData({});
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (formData.dailyLimitPerPerson <= 0) {
            toast.error('Daily limit per person must be greater than 0');
            return;
        }
        if (formData.rate < 0) {
            toast.error('Rate cannot be negative');
            return;
        }

        try {
            setSaving(true);

            const response = await api.put(`/api/config/thresholds/${editingResource}`, formData);

            // Update threshold in list
            const updatedThreshold = response.data.data || response.data.threshold;

            setThresholds(thresholds.map(t =>
                t.resource === editingResource ? updatedThreshold : t
            ));

            setEditingResource(null);
            setFormData({});
            toast.success('Threshold updated successfully');
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data?.error || 'Failed to update threshold');
        } finally {
            setSaving(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: name === 'unit' ? value : parseFloat(value) || 0
        });
    };

    if (user?.role !== 'admin') {
        return (
            <div className="dashboard-container">
                <div className="form-error">
                    Access denied. Only administrators can configure thresholds.
                </div>
            </div>
        );
    }

    if (loading) return <Loading />;

    return (
        <div className="dashboard-container fade-in">
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 className="page-title">Threshold Configuration</h1>
                <p className="text-muted">
                    Configure resource usage thresholds and limits for alert generation
                </p>
            </div>

            {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}

            {/* Thresholds Table */}
            <div className="card">
                <div className="card-header">
                    <h3>Resource Thresholds</h3>
                </div>
                <div className="card-body">
                    {thresholds.length === 0 ? (
                        <div className="empty-state">
                            <p>No thresholds configured</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th onClick={() => handleSort('resource')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'resource' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                            Resource <SortIcon field="resource" sortField={sortField} sortDirection={sortDirection} />
                                        </th>
                                        <th onClick={() => handleSort('unit')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'unit' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                            Unit <SortIcon field="unit" sortField={sortField} sortDirection={sortDirection} />
                                        </th>
                                        <th onClick={() => handleSort('dailyLimitPerPerson')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'dailyLimitPerPerson' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                            Daily/Person <SortIcon field="dailyLimitPerPerson" sortField={sortField} sortDirection={sortDirection} />
                                        </th>
                                        <th onClick={() => handleSort('dailyLimitPerBlock')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'dailyLimitPerBlock' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                            Daily/Block <SortIcon field="dailyLimitPerBlock" sortField={sortField} sortDirection={sortDirection} />
                                        </th>
                                        <th onClick={() => handleSort('monthlyLimitPerPerson')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'monthlyLimitPerPerson' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                            Monthly/Person <SortIcon field="monthlyLimitPerPerson" sortField={sortField} sortDirection={sortDirection} />
                                        </th>
                                        <th onClick={() => handleSort('monthlyLimitPerBlock')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'monthlyLimitPerBlock' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                            Monthly/Block <SortIcon field="monthlyLimitPerBlock" sortField={sortField} sortDirection={sortDirection} />
                                        </th>
                                        <th onClick={() => handleSort('rate')} className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${sortField === 'rate' ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                            Cost/Unit <SortIcon field="rate" sortField={sortField} sortDirection={sortDirection} />
                                        </th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedThresholds.map(threshold => (
                                        <tr key={threshold._id}>
                                            <td>
                                                <strong>{threshold.resource}</strong>
                                            </td>
                                            <td>{threshold.unit}</td>
                                            <td>{threshold.dailyLimitPerPerson?.toLocaleString() || '-'}</td>
                                            <td>{threshold.dailyLimitPerBlock?.toLocaleString() || '-'}</td>
                                            <td>{threshold.monthlyLimitPerPerson?.toLocaleString() || '-'}</td>
                                            <td>{threshold.monthlyLimitPerBlock?.toLocaleString() || '-'}</td>
                                            <td>₹{threshold.rate?.toFixed(2) || '0.00'}</td>
                                            <td>
                                                <button
                                                    onClick={() => handleEdit(threshold)}
                                                    className="btn btn-sm btn-primary"
                                                >
                                                    Edit
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Modal */}
            {editingResource && (
                <div className="modal-overlay" onClick={handleCancel}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-header">
                                <h3>Edit Threshold: {editingResource}</h3>
                                <button type="button" onClick={handleCancel} className="btn btn-ghost">×</button>
                            </div>

                            <div className="modal-body">
                                <div className="form-grid">
                                    <div>
                                        <label className="form-label">Unit</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            name="unit"
                                            value={formData.unit || ''}
                                            onChange={handleInputChange}
                                            placeholder="e.g., kWh, Liters, kg"
                                        />
                                    </div>

                                    <div>
                                        <label className="form-label">Cost per Unit (₹)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            name="rate"
                                            value={formData.rate || ''}
                                            onChange={handleInputChange}
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div>
                                        <label className="form-label">Daily Limit per Person</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            name="dailyLimitPerPerson"
                                            value={formData.dailyLimitPerPerson || ''}
                                            onChange={handleInputChange}
                                            placeholder="0"
                                        />
                                    </div>

                                    <div>
                                        <label className="form-label">Daily Limit per Block</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            name="dailyLimitPerBlock"
                                            value={formData.dailyLimitPerBlock || ''}
                                            onChange={handleInputChange}
                                            placeholder="0"
                                        />
                                    </div>

                                    <div>
                                        <label className="form-label">Monthly Limit per Person</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            name="monthlyLimitPerPerson"
                                            value={formData.monthlyLimitPerPerson || ''}
                                            onChange={handleInputChange}
                                            placeholder="0"
                                        />
                                    </div>

                                    <div>
                                        <label className="form-label">Monthly Limit per Block</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            name="monthlyLimitPerBlock"
                                            value={formData.monthlyLimitPerBlock || ''}
                                            onChange={handleInputChange}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                <div style={{ marginTop: 16, padding: 12, backgroundColor: 'var(--bg)', borderRadius: 8 }}>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--muted)', margin: 0 }}>
                                        <strong>Note:</strong> These limits are used for calculating sustainability scores and triggering alerts when exceeded. Monthly limits are used for the current month period.
                                    </p>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    onClick={handleCancel}
                                    className="btn btn-outline"
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
