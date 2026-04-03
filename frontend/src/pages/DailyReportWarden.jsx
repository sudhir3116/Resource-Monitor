import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Save,
  CheckCircle,
  AlertCircle,
  Trash2,
  Calendar,
  Building2,
  Activity,
  ClipboardList,
  FileText,
  Clock,
  User,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  Zap,
  Droplets,
  Flame,
  Wind,
  Sun,
  Trash2 as TrashIcon
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { logger } from '../utils/logger';


import { useResources } from '../hooks/useResources';

const DailyReportWarden = () => {
  const { resources } = useResources();
  const getResourceIcon = (type) => {
    const res = (resources || []).find(r => r.name === type);
    if (!res?.icon) return <Activity size={16} />;
    if (typeof res.icon === 'string' && res.icon.length < 5) return <span className="text-lg leading-none">{res.icon}</span>;
    return <Activity size={16} />;
  };

  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('submit');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [todaySubmitted, setTodaySubmitted] = useState(false);
  const [reports, setReports] = useState([]);
  const [dynamicResources, setDynamicResources] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [blockFilter, setBlockFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    resourceCheck: [],
    issues: '',
    studentsPresent: 0,
    maintenanceDone: '',
    overallStatus: 'NORMAL'
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, todayRes, blocksRes] = await Promise.allSettled([
        api.get('/api/resources'),
        user?.role === 'warden' ? api.get('/api/daily-reports/today/check') : Promise.reject(new Error('Not a warden')),
        (user?.role === 'admin' || user?.role === 'gm') ? api.get('/api/admin/blocks') : Promise.resolve({ status: 'rejected' })
      ]);

      if (configRes.status === 'fulfilled') {
        const resources = (configRes.value.data.data || configRes.value.data.resources || []).filter(r => r?.isActive === true);
        setDynamicResources(resources);
        setFormData(prev => ({
          ...prev,
          resourceCheck: resources.map(r => ({
            resource: r.name,
            checked: false,
            currentReading: 0,
            notes: ''
          }))
        }));
      }

      if (todayRes.status === 'fulfilled') {
        setTodaySubmitted(todayRes.value.data.data.submitted);
        if (todayRes.value.data.data.submitted) {
          setMessage({
            type: 'info',
            text: `✓ Report submitted today at ${new Date(todayRes.value.data.data.report.submittedAt).toLocaleTimeString()}`
          });
        }
      }

      if (blocksRes.status === 'fulfilled') {
        setBlocks(blocksRes.value.data.data || blocksRes.value.data.blocks || []);
      }

    } catch (err) {
      logger.error('Error fetching data for daily report:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let url = '/api/daily-reports';
      if (user?.role === 'admin' || user?.role === 'gm') {
        url = `/api/daily-reports?all=true&limit=100${blockFilter ? `&blockId=${blockFilter}` : ''}${dateFilter ? `&date=${dateFilter}` : ''}`;
      } else {
        url = '/api/daily-reports?limit=30';
      }

      const res = await api.get(url);
      setReports(res.data?.data?.reports || []);
    } catch (err) {
      setError('Failed to load daily reports');
    } finally {
      setLoading(false);
    }
  }, [user, blockFilter, dateFilter]);

  useEffect(() => {
    fetchData();
    const refresh = () => fetchData();
    window.addEventListener('usage:added', refresh);
    return () => window.removeEventListener('usage:added', refresh);
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchReports();
    }
  }, [activeTab, fetchReports]);

  const handleResourceCheck = (index, field, value) => {
    const updated = [...formData.resourceCheck];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, resourceCheck: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/api/daily-reports', {
        blockId: user.block,
        ...formData
      });
      setMessage({ type: 'success', text: 'Daily report submitted successfully!' });
      setTodaySubmitted(true);
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to submit report' });
    } finally {
      setLoading(false);
    }
  };

  // Removed static getResourceIcon as it is now shared in the scope above

  if (!['warden', 'admin', 'gm'].includes(user?.role)) {
    return <EmptyState title="Access Denied" description="You do not have permission to access daily reports." />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3" style={{ color: 'var(--text-primary)' }}>
            <ClipboardList className="text-blue-600" /> Daily Compliance Log
          </h1>
          <p className="text-slate-500 mt-1">
            Official daily operational report and resource verification
          </p>
        </div>
        <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setActiveTab('submit')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'submit' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            Submit Report
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            Log History
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30' :
          message.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/30' :
            'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/30'
          }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-semibold">{message.text}</span>
        </div>
      )}

      {activeTab === 'submit' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card title="Operational Status" description="Report any infrastructure or student-related issues">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="form-label">Active Student Headcount</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="number"
                        placeholder="Current headcount"
                        value={formData.studentsPresent}
                        onChange={(e) => setFormData({ ...formData, studentsPresent: parseInt(e.target.value) })}
                        className="form-input pl-10 h-14 text-lg font-bold"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="form-label">Overall Block Health</label>
                    <select
                      value={formData.overallStatus}
                      onChange={(e) => setFormData({ ...formData, overallStatus: e.target.value })}
                      className="form-input h-14 text-sm font-bold"
                    >
                      <option value="NORMAL">Normal Operation</option>
                      <option value="ISSUES_FOUND">Minor Issues Identified</option>
                      <option value="CRITICAL">Critical Attention Required</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="form-label">Infrastructure & Maintenance Issues</label>
                  <textarea
                    value={formData.issues}
                    onChange={(e) => setFormData({ ...formData, issues: e.target.value })}
                    rows="3"
                    className="form-input min-h-[120px] py-4 leading-relaxed"
                    placeholder="Describe any leaks, power failures, or damage in detail..."
                  />
                </div>

                <div className="space-y-3">
                  <label className="form-label">Daily Maintenance Operations</label>
                  <textarea
                    value={formData.maintenanceDone}
                    onChange={(e) => setFormData({ ...formData, maintenanceDone: e.target.value })}
                    rows="3"
                    className="form-input min-h-[120px] py-4 leading-relaxed"
                    placeholder="Detail routine maintenance tasks or repairs completed today..."
                  />
                </div>

                {!todaySubmitted && (
                  <Button type="submit" variant="primary" className="w-full h-14 text-lg" disabled={loading}>
                    {loading ? <RefreshCw className="animate-spin mr-2" /> : <Save className="mr-2" />}
                    Finalize and Submit Report
                  </Button>
                )}
              </form>
            </Card>
          </div>

          <div className="space-y-8">
            <Card title="Resource Verification" description="Record current meter readings">
              <div className="space-y-4 pt-2">
                {formData.resourceCheck.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                          {getResourceIcon(item.resource)}
                        </div>
                        <span className="font-bold text-sm tracking-tight">{item.resource}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(e) => handleResourceCheck(idx, 'checked', e.target.checked)}
                        className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Meter Reading</label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.currentReading}
                          onChange={(e) => handleResourceCheck(idx, 'currentReading', parseFloat(e.target.value))}
                          className="form-input h-10 text-sm font-mono"
                          placeholder="Reading..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Verification Note</label>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) => handleResourceCheck(idx, 'notes', e.target.value)}
                          className="form-input h-10 text-sm"
                          placeholder="No anomalies..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="p-6 rounded-3xl bg-blue-600 text-white space-y-4 shadow-xl shadow-blue-600/20">
              <div className="p-3 bg-white/20 rounded-2xl h-fit w-fit">
                <AlertCircle />
              </div>
              <h4 className="font-bold text-lg leading-tight">Submission Notice</h4>
              <p className="text-sm text-blue-50/80 leading-relaxed">
                Reports once submitted are audited by the General Manager. Ensure all sensory data and readings are verified before submission.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <Card title="Audit History" description="Previously submitted reports and administrative reviews">
          {(user?.role === 'admin' || user?.role === 'gm') && (
            <div className="flex flex-wrap items-center gap-4 mb-8">
              <div className="relative min-w-[200px]">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select
                  value={blockFilter}
                  onChange={e => setBlockFilter(e.target.value)}
                  className="form-input pl-10 h-10 text-sm"
                >
                  <option value="">All Blocks</option>
                  {blocks.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="form-input pl-10 h-10 text-sm"
                />
              </div>
              <Button variant="secondary" size="sm" onClick={fetchReports}>
                <Search size={14} className="mr-2" /> Filter
              </Button>
            </div>
          )}

          <div className="overflow-x-auto -mx-6">
            <table className="table">
              <thead>
                <tr>
                  <th className="pl-6">Submission Date</th>
                  {(user?.role === 'admin' || user?.role === 'gm') && <th>Block</th>}
                  <th>Overall Status</th>
                  <th>Verification</th>
                  <th className="pr-6">Review</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-20 text-slate-500 italic">No historical logs found for the selected criteria.</td></tr>
                ) : (
                  reports.map(report => (
                    <tr key={report._id} className="group hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="pl-6">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                            <Calendar size={14} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-sm tracking-tight">{new Date(report.date).toLocaleDateString()}</span>
                            <span className="text-[10px] text-slate-400">{new Date(report.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </td>
                      {(user?.role === 'admin' || user?.role === 'gm') && (
                        <td className="font-semibold text-sm">{report.block?.name || 'Block N/A'}</td>
                      )}
                      <td>
                        <Badge variant={report.overallStatus === 'NORMAL' ? 'success' : report.overallStatus === 'ISSUES_FOUND' ? 'warning' : 'danger'}>
                          {report.overallStatus}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex -space-x-1">
                          {(report.resourceCheck || []).filter(r => r.checked).map((r, i) => (
                            <div key={i} title={r.resource} className="h-6 w-6 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                              {getResourceIcon(r.resource)}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="pr-6">
                        {report.reviewedAt ? (
                          <div className="flex items-center gap-1.5 text-emerald-500 text-xs font-bold uppercase tracking-wider">
                            <CheckCircle size={14} /> Audited
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs font-bold uppercase tracking-wider">
                            <Clock size={14} /> Pending
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default DailyReportWarden;
