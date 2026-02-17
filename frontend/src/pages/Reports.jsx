import React, { useEffect, useState, useContext } from 'react';
import api from '../services/api';
import { Download, Search, Filter, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import { exportToCSV } from '../utils/export';
import { useToast } from '../context/ToastContext';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'usage_date', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    async function fetchReports() {
      try {
        const res = await api.get('/api/usage');
        setReports(res.data.usages || []);
      } catch (err) {
        addToast('Failed to load reports', 'error');
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedReports = () => {
    return [...reports].sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      // Handle nested properties if needed, or dates
      if (sortConfig.key === 'usage_date') {
        valA = new Date(valA);
        valB = new Date(valB);
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const filteredReports = getSortedReports().filter(r =>
    (r.resource_type || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.userId?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    const data = filteredReports.map(r => ({
      Date: new Date(r.usage_date).toLocaleString(),
      Resource: r.resource_type,
      Value: r.usage_value,
      Unit: r.unit || 'units',
      Category: r.category || 'N/A',
      LoggedBy: r.userId?.name || 'N/A',
      Notes: r.notes || ''
    }));
    exportToCSV(data, `detailed_report_${new Date().toISOString().split('T')[0]}.csv`);
    addToast('Report exported successfully');
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 style={{ color: 'var(--text-primary)' }}>Usage Reports</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Detailed log of resource consumption across the campus
          </p>
        </div>
        <Button variant="primary" onClick={handleExport}>
          <Download size={16} className="mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              className="input pl-10"
              placeholder="Search by resource, location, or user..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="py-20 text-center text-slate-500">Loading data...</div>
        ) : filteredReports.length === 0 ? (
          <EmptyState
            title="No Data Found"
            description="No records match your search criteria."
            icon={<FileText size={48} />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="cursor-pointer hover:text-blue-500" onClick={() => handleSort('usage_date')}>
                    <div className="flex items-center gap-1">Date {getSortIcon('usage_date')}</div>
                  </th>
                  <th className="cursor-pointer hover:text-blue-500" onClick={() => handleSort('resource_type')}>
                    <div className="flex items-center gap-1">Resource {getSortIcon('resource_type')}</div>
                  </th>
                  <th>Value</th>
                  <th>Location / Category</th>
                  <th>Logged By</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr key={report._id}>
                    <td>{new Date(report.usage_date).toLocaleDateString()} <span className="text-slate-400 text-xs">{new Date(report.usage_date).toLocaleTimeString()}</span></td>
                    <td>
                      <Badge variant={report.resource_type === 'Electricity' ? 'warning' : 'primary'}>
                        {report.resource_type}
                      </Badge>
                    </td>
                    <td className="font-mono font-medium">{report.usage_value} {report.unit}</td>
                    <td>{report.category || '-'}</td>
                    <td>{report.userId?.name || 'Unknown'}</td>
                    <td className="max-w-xs truncate text-slate-500" title={report.notes}>{report.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="text-right text-sm text-slate-500">
        Showing {filteredReports.length} records
      </div>
    </div>
  );
}
