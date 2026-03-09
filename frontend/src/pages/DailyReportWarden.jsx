import React, { useState, useEffect, useContext } from 'react';
import { Save, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const DailyReportWarden = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('submit');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [todaySubmitted, setTodaySubmitted] = useState(false);
  const [reports, setReports] = useState([]);
  const [resources, setResources] = useState([]);
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

  useEffect(() => {
    if (user?.role === 'warden') {
      checkTodayReport();
      fetchResources();
    }
    if (user?.role === 'admin' || user?.role === 'gm') {
      api.get('/api/admin/blocks').then(res => setBlocks(res.data.data || res.data.blocks || []));
    }
    if (activeTab === 'history') {
      fetchReports();
    }
  }, [activeTab, user]);

  const checkTodayReport = async () => {
    try {
      const response = await api.get('/daily-reports/today/check');
      setTodaySubmitted(response.data.data.submitted);
      if (response.data.data.submitted) {
        setMessage({ type: 'info', text: `✓ Report submitted today at ${new Date(response.data.data.report.submittedAt).toLocaleTimeString()}` });
      }
    } catch (err) {
      console.error('Error checking today report:', err);
    }
  };

  const fetchResources = async () => {
    try {
      const response = await api.get('/config');
      const resourcesList = response.data.data || [];
      setResources(resourcesList.map(r => ({
        resource: r.resource,
        checked: false,
        currentReading: 0,
        notes: ''
      })));
      setFormData(prev => ({
        ...prev,
        resourceCheck: resourcesList.map(r => ({
          resource: r.resource,
          checked: false,
          currentReading: 0,
          notes: ''
        }))
      }));
    } catch (err) {
      console.error('Error fetching resources:', err);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true)
      setError(null)

      let url = '/api/daily-reports'

      // Admin and GM see all reports
      // Warden sees only own block reports
      if (user?.role === 'admin' || user?.role === 'gm') {
        url = '/api/daily-reports?all=true&limit=100'
      } else {
        url = '/api/daily-reports?limit=30'
      }

      const res = await api.get(url)
      // Backend returns: { success: true, data: { reports: [...], pagination: {...} } }
      const fetchedReports = res.data?.data?.reports || []

      setReports(fetchedReports)
    } catch (err) {
      console.error('Daily reports error:', err)
      setError('Failed to load daily reports')
    } finally {
      setLoading(false)
    }
  }

  const handleResourceCheck = (index, field, value) => {
    const updated = [...formData.resourceCheck];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, resourceCheck: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.post('/daily-reports', {
        blockId: user.block,
        ...formData
      });
      setMessage({ type: 'success', text: 'Daily report submitted successfully!' });
      setTodaySubmitted(true);
      setFormData({
        resourceCheck: formData.resourceCheck.map(r => ({ ...r, checked: false, currentReading: 0, notes: '' })),
        issues: '',
        studentsPresent: 0,
        maintenanceDone: '',
        overallStatus: 'NORMAL'
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Failed to submit report' });
    } finally {
      setLoading(false);
    }
  };

  if (!['warden', 'admin', 'gm'].includes(user?.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You do not have permission to access daily reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${message.type === 'success'
              ? 'bg-green-100 text-green-700 border border-green-400'
              : message.type === 'error'
                ? 'bg-red-100 text-red-700 border border-red-400'
                : 'bg-blue-100 text-blue-700 border border-blue-400'
            }`}>
            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            {message.text}
          </div>
        )}

        {/* Status Banner */}
        {todaySubmitted && (
          <div className="mb-6 p-4 bg-green-100 border border-green-400 rounded-lg flex items-center gap-2">
            <CheckCircle className="text-green-700" size={24} />
            <div>
              <p className="font-semibold text-green-900">Today's Report Submitted ✓</p>
              <p className="text-sm text-green-700">You have already submitted your daily report for today.</p>
            </div>
          </div>
        )}

        {/* Header */}
        <h1 className="text-3xl font-bold text-gray-900 mb-6">📋 Daily Report</h1>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b">
            {user?.role === 'warden' && (
              <button
                onClick={() => setActiveTab('submit')}
                className={`px-4 py-3 font-medium ${activeTab === 'submit'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                  } ${todaySubmitted ? 'opacity-50' : ''}`}
              >
                {todaySubmitted ? '✓ Today\'s Report' : 'Submit Report'}
              </button>
            )}
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-3 font-medium ${activeTab === 'history'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Report History
            </button>
          </div>

          {/* Submit Tab */}
          {activeTab === 'submit' && (
            <div className="p-6">
              {todaySubmitted ? (
                <div className="text-center py-8">
                  <CheckCircle size={48} className="mx-auto text-green-600 mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Report Already Submitted</h3>
                  <p className="text-gray-600">You can submit a new report tomorrow.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Resource Checklist */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource Checklist</h3>
                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                      {formData.resourceCheck.length === 0 ? (
                        <p className="text-gray-600">Loading resources...</p>
                      ) : (
                        formData.resourceCheck.map((item, idx) => (
                          <div key={idx} className="bg-white p-4 rounded border">
                            <div className="flex items-center gap-3 mb-3">
                              <input
                                type="checkbox"
                                checked={item.checked}
                                onChange={(e) => handleResourceCheck(idx, 'checked', e.target.checked)}
                                className="w-5 h-5 text-blue-600"
                              />
                              <label className="text-sm font-medium text-gray-900">{item.resource}</label>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Current Reading</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.currentReading}
                                  onChange={(e) => handleResourceCheck(idx, 'currentReading', parseFloat(e.target.value))}
                                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="Enter meter reading"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                                <input
                                  type="text"
                                  value={item.notes}
                                  onChange={(e) => handleResourceCheck(idx, 'notes', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="Any issues or notes?"
                                />
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Issues */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Any Issues Found?</label>
                    <textarea
                      value={formData.issues}
                      onChange={(e) => setFormData({ ...formData, issues: e.target.value })}
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Describe any issues found in the block"
                    />
                  </div>

                  {/* Students Present */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Students Present</label>
                    <input
                      type="number"
                      value={formData.studentsPresent}
                      onChange={(e) => setFormData({ ...formData, studentsPresent: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>

                  {/* Maintenance Done */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maintenance Work Done</label>
                    <textarea
                      value={formData.maintenanceDone}
                      onChange={(e) => setFormData({ ...formData, maintenanceDone: e.target.value })}
                      rows="3"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Describe any maintenance or repairs done"
                    />
                  </div>

                  {/* Overall Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Overall Status</label>
                    <select
                      value={formData.overallStatus}
                      onChange={(e) => setFormData({ ...formData, overallStatus: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="NORMAL">Normal - No Issues</option>
                      <option value="ISSUES_FOUND">Issues Found - Minor</option>
                      <option value="CRITICAL">Critical - Immediate Action Needed</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
                  >
                    <Save size={20} /> Submit Daily Report
                  </button>
                </form>
              )}
            </div>
          )}

          {/* History Tab */}
          {(activeTab === 'history' || user?.role !== 'warden') && (
            <div className="p-6">
              {(user?.role === 'admin' || user?.role === 'gm') && (
                <div className="flex items-center gap-3 mb-4">
                  <select
                    value={blockFilter}
                    onChange={e => setBlockFilter(e.target.value)}
                    className="px-3 py-2 bg-gray-700 border 
                               border-gray-600 rounded-lg 
                               text-sm text-white"
                  >
                    <option value="">All Blocks</option>
                    {blocks.map(b => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={e => setDateFilter(e.target.value)}
                    className="px-3 py-2 bg-gray-700 border 
                               border-gray-600 rounded-lg 
                               text-sm text-white"
                  />
                </div>
              )}
              {error && <p className="text-red-500 mb-4">{error}</p>}
              {loading ? (
                <p className="text-center text-gray-500">Loading reports...</p>
              ) : reports.length === 0 ? (
                <p className="text-center text-gray-500">No reports found</p>
              ) : (
                <div className="space-y-4">
                  {reports.map((report) => (
                    <div key={report._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {new Date(report.date).toLocaleDateString()}
                          </p>
                          <p className={`text-sm ${report.overallStatus === 'NORMAL' ? 'text-green-600' :
                              report.overallStatus === 'ISSUES_FOUND' ? 'text-yellow-600' :
                                'text-red-600'
                            }`}>
                            {report.overallStatus === 'NORMAL' ? '✓' : '⚠'} {report.overallStatus}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">
                            Submitted: {new Date(report.submittedAt).toLocaleTimeString()}
                          </p>
                          {report.reviewedAt && (
                            <p className="text-sm text-green-600">Reviewed ✓</p>
                          )}
                        </div>
                      </div>
                      {report.issues && (
                        <p className="mt-2 text-sm text-gray-600"><strong>Issues:</strong> {report.issues}</p>
                      )}
                      {report.adminNotes && (
                        <p className="mt-2 text-sm text-blue-600"><strong>Admin Notes:</strong> {report.adminNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyReportWarden;
