import React, { useEffect, useState, useContext } from 'react';
import api from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ROLES } from '../utils/roles';
import { exportToCSV } from '../utils/export';
import {
  Plus,
  Search,
  Download,
  Edit2,
  Trash2,
  Zap,
  Droplets,
  Flame,
  Wind,
  Utensils,
  Trash
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { ConfirmModal } from '../components/common/Modal';
import { useToast } from '../context/ToastContext';

export default function UsageList() {
  const [usages, setUsages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [resourceFilter, setResourceFilter] = useState('All');
  const [deleteId, setDeleteId] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null); // Track full item for detailed modal
  const [sortConfig, setSortConfig] = useState({ key: 'usage_date', direction: 'desc' });

  const { user } = useContext(AuthContext);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const canEdit = user && [ROLES.ADMIN, ROLES.WARDEN].includes(user.role);
  const canDelete = user && [ROLES.ADMIN, ROLES.WARDEN].includes(user.role);
  const showActions = canEdit || canDelete;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/api/usage');
      // Handle both old and new response structures for safety during migration
      setUsages(res.data.usages || (Array.isArray(res.data) ? res.data : []));
    } catch (err) {
      addToast('Failed to load usage records', 'error');
      setUsages([]);
    } finally {
      setLoading(false);
    }
  }

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await api.delete(`/api/usage/${deleteId}`);
      // Re-fetch the list to reflect soft-delete and prevent stale state
      await load();
      // Request alert counts refresh via context if available
      try { if (window && window.dispatchEvent) window.dispatchEvent(new Event('usage:deleted')); } catch (e) {}
      addToast('Record deleted successfully');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete record', 'error');
    } finally {
      setDeleteId(null);
      setDeleteItem(null);
    }
  }

  const confirmDelete = (item) => {
    setDeleteItem(item);
    setDeleteId(item._id);
  };

  const sortedUsages = React.useMemo(() => {
    let sortableItems = [...usages];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Handle nested properties like userId.name
        if (sortConfig.key === 'user') {
          aValue = a.userId?.name || '';
          bValue = b.userId?.name || '';
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [usages, sortConfig]);

  const filteredUsages = sortedUsages.filter(u => {
    const matchesSearch = (u.userId?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesResource = resourceFilter === 'All' || u.resource_type === resourceFilter;
    return matchesSearch && matchesResource;
  });

  const getResourceIcon = (type) => {
    switch (type) {
      case 'Electricity': return <Zap size={16} className="text-amber-500" />;
      case 'Water': return <Droplets size={16} className="text-blue-500" />;
      case 'LPG': return <Flame size={16} className="text-orange-500" />;
      case 'Diesel': return <Wind size={16} className="text-slate-500" />;
      case 'Food': return <Utensils size={16} className="text-emerald-500" />;
      case 'Waste': return <Trash size={16} className="text-rose-500" />;
      default: return <Zap size={16} />;
    }
  };

  const handleExport = () => {
    if (filteredUsages.length === 0) {
      addToast('No records to export', 'warning');
      return;
    }
    const dataToExport = filteredUsages.map(u => ({
      Resource: u.resource_type,
      Value: u.usage_value,
      Unit: u.unit || 'units',
      Date: new Date(u.usage_date).toLocaleString(),
      User: u.userId?.name || 'N/A',
      Notes: u.notes || ''
    }));
    exportToCSV(dataToExport, `usage_records_${new Date().toISOString().split('T')[0]}.csv`);
    addToast('Usage data exported');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 style={{ color: 'var(--text-primary)' }}>Usage Records</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            View and manage resource consumption logs
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleExport} disabled={loading || usages.length === 0}>
            <Download size={16} className="mr-2" />
            Export
          </Button>
          {canEdit && (
            <Button variant="primary" onClick={() => navigate('/usage/new')}>
              <Plus size={16} className="mr-2" />
              Log Usage
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search records..."
              className="input pl-10 w-full"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="input w-full md:w-48"
            value={resourceFilter}
            onChange={e => setResourceFilter(e.target.value)}
          >
            <option value="All">All Resources</option>
            <option value="Electricity">Electricity</option>
            <option value="Water">Water</option>
            <option value="Food">Food</option>
            <option value="LPG">LPG</option>
            <option value="Diesel">Diesel</option>
            <option value="Waste">Waste</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="py-20 text-center">
            <div className="spinner mb-4"></div>
            <p className="text-slate-500">Loading records...</p>
          </div>
        ) : filteredUsages.length === 0 ? (
          <EmptyState title="No Records Found" description="Try adjusting your filters or add a new record." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th onClick={() => requestSort('resource_type')} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">Resource</th>
                  <th onClick={() => requestSort('usage_value')} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">Value</th>
                  <th onClick={() => requestSort('usage_date')} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">Date</th>
                  <th onClick={() => requestSort('user')} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">Logged By</th>
                  <th>Notes</th>
                  {showActions && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredUsages.map(u => (
                  <tr key={u._id}>
                    <td>
                      <div className="flex items-center gap-2">
                        {getResourceIcon(u.resource_type)}
                        <span className="font-medium">{u.resource_type}</span>
                      </div>
                    </td>
                    <td>
                      <span className="font-bold">{u.usage_value}</span>
                      <span className="text-xs text-slate-500 ml-1">{u.unit || 'units'}</span>
                    </td>
                    <td>{new Date(u.usage_date).toLocaleDateString()}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">
                          {u.userId?.name?.charAt(0) || '?'}
                        </div>
                        <span className="text-sm">{u.userId?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="max-w-xs truncate text-slate-500">{u.notes || '-'}</td>
                    {showActions && (
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          {canEdit && (
                            <Button size="sm" variant="secondary" onClick={() => navigate(`/usage/${u._id}/edit`)}>
                              <Edit2 size={14} />
                            </Button>
                          )}
                          {canDelete && (
                            <Button size="sm" variant="danger" onClick={() => confirmDelete(u)}>
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => { setDeleteId(null); setDeleteItem(null); }}
        onConfirm={handleDelete}
        title="Delete Usage Record"
        message={deleteItem
          ? `Are you sure you want to delete the ${deleteItem.resource_type} usage record of ${deleteItem.usage_value} units recorded on ${new Date(deleteItem.usage_date).toLocaleDateString()}?\n\nThis action cannot be undone.`
          : "Are you sure you want to delete this record?"}
      />
    </div>
  );
}
