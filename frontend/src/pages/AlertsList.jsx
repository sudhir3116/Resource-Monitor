import React, { useEffect, useState, useCallback } from 'react';
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
  Shield,
  Bell,
  Settings,
  RefreshCw,
  Clock,
  User,
  Flame,
  Wind,
  Sun,
  Trash
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { ConfirmModal } from '../components/common/Modal';
import { logger } from '../utils/logger';

const RESOURCE_META = {
  Electricity: { icon: <Zap size={18} />, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  Water: { icon: <Droplets size={18} />, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  LPG: { icon: <Flame size={18} />, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  Diesel: { icon: <Wind size={18} />, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-900/20' },
  Solar: { icon: <Sun size={18} />, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  Waste: { icon: <Trash size={18} />, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' },
};

export default function AlertsList() {
  const [rules, setRules] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('system');
  const [deleteId, setDeleteId] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);

  const { addToast } = useToast();
  const navigate = useNavigate();

  const load = useCallback(async () => {
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
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  async function deleteRule() {
    if (!deleteId) return;
    try {
      await api.delete(`/api/alerts/${deleteId}`);
      setRules(prev => prev.filter(r => r._id !== deleteId));
      addToast('Rule deleted successfully', 'success');
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
        addToast(`Rule ${!rule.active ? 'activated' : 'deactivated'}`, 'success');
      }
    } catch (e) {
      addToast(e.response?.data?.message || 'Failed to toggle rule', 'error');
    }
  }

  const getMeta = (type) => RESOURCE_META[type] || { icon: <Activity size={18} />, color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-800' };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            System <span className="text-blue-600">Sentinels</span>
          </h1>
          <p className="text-slate-500 mt-1">
            Real-time anomaly detection and automated resource governance
          </p>
        </div>
        <div className="flex gap-3">
          {activeTab === 'rules' && (
            <Button variant="primary" onClick={() => navigate('/alerts/new')} className="h-11 px-6 shadow-lg shadow-blue-600/20">
              <Plus size={18} className="mr-2" /> New Protocol
            </Button>
          )}
          <Button variant="secondary" onClick={load} className="h-11 w-11 p-0">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* Tabs Design */}
      <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl w-fit border border-slate-200 dark:border-slate-800 shadow-sm">
        <button
          onClick={() => setActiveTab('system')}
          className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'system'
            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-md ring-1 ring-slate-200 dark:ring-slate-600'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
        >
          <Bell size={16} /> Active Alerts
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all duration-300 ${activeTab === 'rules'
            ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-md ring-1 ring-slate-200 dark:ring-slate-600'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
        >
          <Settings size={16} /> Alert Rules
        </button>
      </div>

      {loading && !rules.length && !systemAlerts.length ? (
        <div className="py-32 flex flex-col items-center justify-center space-y-4">
          <RefreshCw className="animate-spin text-blue-600" size={48} strokeWidth={1} />
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Scanning Grid Sensors...</p>
        </div>
      ) : (
        <div className="animate-in fade-in duration-500">
          {activeTab === 'system' && (
            <div className="space-y-4">
              {systemAlerts.length === 0 ? (
                <EmptyState
                  title="No Anomalies Detected"
                  description="All grid nodes are operating within established thresholds. System integrity at 100%."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {systemAlerts.map(alert => {
                    const meta = getMeta(alert.resourceType);
                    return (
                      <Card key={alert._id} className={`border-l-4 ${alert.status === 'danger' ? 'border-l-rose-500 shadow-rose-500/5 bg-rose-50/10' : 'border-l-amber-500 shadow-amber-500/5 bg-amber-50/10'}`}>
                        <div className="flex items-start gap-6">
                          <div className={`p-4 rounded-2xl ${alert.status === 'danger' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'}`}>
                            <AlertTriangle size={24} />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex justify-between items-center">
                              <h3 className="font-black text-xs uppercase tracking-[0.2em] text-slate-400">
                                {alert.status === 'danger' ? 'Critical Exception' : 'Warning Alert'}
                              </h3>
                              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <Clock size={12} /> {new Date(alert.createdAt).toLocaleTimeString()}
                              </div>
                            </div>
                            <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                              {alert.resourceType} Threshold Breach
                            </h2>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-2xl">
                              {alert.message}
                            </p>
                            {alert.user && (
                              <div className="pt-3 flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black">
                                  <User size={12} />
                                </div>
                                <span className="text-xs font-bold text-slate-500 uppercase">Observer: {alert.user.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rules.length === 0 ? (
                <div className="col-span-full">
                  <EmptyState title="No Sentinel Rules" description="Initialize a monitoring protocol to start tracking resource anomalies." />
                </div>
              ) : (
                rules.map(rule => {
                  const meta = getMeta(rule.resource_type);
                  return (
                    <Card key={rule._id} className="relative group overflow-hidden hover:shadow-xl transition-all duration-300">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex items-center gap-4">
                          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${meta.bg} ${meta.color} shadow-inner`}>
                            {meta.icon}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{rule.resource_type}</h3>
                            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">
                              {rule.comparison === 'gt' ? 'Value exceeds' : 'Value drops below'} <span className="text-blue-600">{rule.threshold_value}</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant={rule.active ? 'success' : 'secondary'} className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-widest">
                          {rule.active ? 'Armed' : 'Standby'}
                        </Badge>
                      </div>

                      <div className="flex gap-2 pt-6 border-t border-slate-50 dark:border-slate-800">
                        <Button
                          className="flex-1 h-10 text-[10px] font-black uppercase tracking-widest"
                          variant="secondary"
                          onClick={() => toggleRule(rule)}
                        >
                          {rule.active ? <><PauseCircle size={14} className="mr-2" /> Standby</> : <><PlayCircle size={14} className="mr-2" /> Arm Protocol</>}
                        </Button>
                        <Button
                          className="w-10 h-10 p-0"
                          variant="secondary"
                          onClick={() => navigate(`/alerts/${rule._id}/edit`)}
                        >
                          <Edit2 size={14} />
                        </Button>
                        <Button
                          className="w-10 h-10 p-0 hover:bg-rose-500 hover:text-white transition-colors"
                          variant="secondary"
                          onClick={() => { setDeleteId(rule._id); setDeleteItem(rule); }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>

                      {/* Decorative Element */}
                      <div className="absolute -bottom-4 -right-4 h-12 w-12 rounded-full border-2 border-slate-100 dark:border-slate-800 opacity-50 group-hover:scale-150 transition-transform duration-700" />
                    </Card>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        onClose={() => { setDeleteId(null); setDeleteItem(null); }}
        onConfirm={deleteRule}
        title="Terminate Sentinel"
        message={deleteItem
          ? `Are you sure you want to permanently delete the ${deleteItem.resource_type} sentinel protocol (${deleteItem.comparison === 'gt' ? '>' : '<'} ${deleteItem.threshold_value})?`
          : "Are you sure you want to terminate this protocol?"}
      />
    </div>
  );
}
