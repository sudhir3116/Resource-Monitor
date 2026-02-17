import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  PlayCircle,
  PauseCircle,
  Zap,
  Droplets,
  Activity,
  Shield
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { ConfirmModal } from '../components/common/Modal';

export default function AlertsList() {
  const [rules, setRules] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('system');
  const [deleteId, setDeleteId] = useState(null);

  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [resRules, resAlerts] = await Promise.all([
        api.get('/api/alerts/rules'),
        api.get('/api/alerts/system')
      ]);
      setRules(resRules.data?.data || resRules.data?.rules || []);
      setSystemAlerts(resAlerts.data?.data || resAlerts.data?.alerts || []);
    } catch (err) {
      addToast('Failed to load alerts data', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function deleteRule() {
    if (!deleteId) return;
    try {
      await api.delete(`/api/alerts/${deleteId}`);
      setRules(prev => prev.filter(r => r._id !== deleteId));
      addToast('Rule deleted successfully');
    } catch (e) {
      addToast(e.response?.data?.message || 'Failed to delete rule', 'error');
    } finally {
      setDeleteId(null);
      setDeleteItem(null);
    }
  }

  async function toggleRule(rule) {
    try {
      const res = await api.patch(`/api/alerts/${rule._id}`, { active: !rule.active });
      if (res.data.success) {
        setRules(prev => prev.map(r => r._id === rule._id ? { ...r, active: !r.active } : r));
        addToast(`Rule ${!rule.active ? 'activated' : 'deactivated'}`);
      }
    } catch (e) {
      addToast(e.response?.data?.message || 'Failed to toggle rule', 'error');
    }
  }

  const [deleteItem, setDeleteItem] = useState(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 style={{ color: 'var(--text-primary)' }}>System Alerts</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Monitor system anomalies and configure detection rules
          </p>
        </div>
        {activeTab === 'rules' && (
          <Button variant="primary" onClick={() => navigate('/alerts/new')}>
            <Plus size={16} className="mr-2" />
            New Rule
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-white dark:bg-slate-800 rounded-lg p-1 w-fit border" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'system'
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
        >
          <Activity size={14} />
          Active Alerts
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'rules'
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
        >
          <Shield size={14} />
          Alert Rules
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="spinner mb-4"></div>
          <p className="text-slate-500">Loading alerts data...</p>
        </div>
      ) : (
        <>
          {activeTab === 'system' && (
            <div className="space-y-4">
              {systemAlerts.length === 0 ? (
                <EmptyState title="No Active Alerts" description="System is running normally." />
              ) : (
                systemAlerts.map(alert => (
                  <Card key={alert._id}>
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-full ${alert.status === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
                        }`}>
                        <AlertTriangle size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                              {alert.resourceType} - {alert.status === 'danger' ? 'Critical' : 'Warning'}
                            </h3>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                              {alert.message}
                            </p>
                          </div>
                          <span className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {new Date(alert.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {alert.user && (
                          <div className="mt-3 text-sm flex items-center gap-2">
                            <span className="text-slate-500">Reported by:</span>
                            <span className="font-medium">{alert.user.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rules.length === 0 ? (
                <div className="col-span-2">
                  <EmptyState title="No Alert Rules" description="Create a rule to start monitoring resources." />
                </div>
              ) : (
                rules.map(rule => (
                  <Card key={rule._id}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${rule.resource_type === 'Electricity' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                          {rule.resource_type === 'Electricity' ? <Zap size={20} /> : <Droplets size={20} />}
                        </div>
                        <div>
                          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{rule.resource_type}</h3>
                          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                            {rule.comparison === 'gt' ? 'Above' : 'Below'} {rule.threshold_value}
                          </div>
                        </div>
                      </div>
                      <Badge variant={rule.active ? 'success' : 'secondary'}>
                        {rule.active ? 'Active' : 'Paused'}
                      </Badge>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => toggleRule(rule)}
                        title={rule.active ? 'Pause Rule' : 'Activate Rule'}
                      >
                        {rule.active ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/alerts/${rule._id}/edit`)}
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => { setDeleteId(rule._id); setDeleteItem(rule); }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => { setDeleteId(null); setDeleteItem(null); }}
        onConfirm={deleteRule}
        title="Delete Rule"
        message={deleteItem
          ? `Are you sure you want to delete the alert rule for ${deleteItem.resource_type} (${deleteItem.comparison === 'gt' ? '>' : '<'} ${deleteItem.threshold_value})?`
          : "Are you sure you want to delete this alert rule?"}
      />
    </div>
  );
}
