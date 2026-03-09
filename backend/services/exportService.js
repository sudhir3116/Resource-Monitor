/**
 * services/exportService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles CSV and PDF export for filtered data with consistent formatting
 * ─────────────────────────────────────────────────────────────────────────────
 */

const PDFDocument = require('pdfkit');
const { Readable } = require('stream');

/**
 * Convert data array to CSV format
 * Properly escapes quotes, commas, and newlines
 * 
 * @param {Array} headers - Column names
 * @param {Array} rows - Array of data rows (arrays)
 * @returns {string} CSV formatted text
 */
function dataToCSV(headers, rows) {
  const escapeCSV = (value) => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map(escapeCSV).join(',');
  const dataRows = rows.map(row => 
    row.map(escapeCSV).join(',')
  );

  return [headerRow, ...dataRows].join('\n');
}

/**
 * Generate CSV stream for usage data
 * 
 * @param {Array} usageRecords - Populated usage documents
 * @returns {string} CSV content
 */
function generateUsageCSV(usageRecords = []) {
  const headers = ['Date', 'Resource', 'Category', 'Value', 'Unit', 'Block', 'User', 'Status', 'Notes'];
  
  const rows = usageRecords.map(record => [
    new Date(record.usage_date).toISOString().split('T')[0],
    record.resource_type || '',
    record.category || '',
    record.usage_value || 0,
    record.unit || '',
    record.blockId?.name || '',
    record.userId?.name || '',
    record.deleted ? 'Deleted' : 'Active',
    record.notes || ''
  ]);

  return dataToCSV(headers, rows);
}

/**
 * Generate CSV stream for alert data
 * 
 * @param {Array} alertRecords - Populated alert documents
 * @returns {string} CSV content
 */
function generateAlertsCSV(alertRecords = []) {
  const headers = ['Date', 'Resource', 'Severity', 'Status', 'Block', 'Usage %', 'Message', 'Resolved By', 'Resolution Date'];
  
  const rows = alertRecords.map(alert => [
    new Date(alert.createdAt).toISOString().split('T')[0],
    alert.resourceType || '',
    alert.severity || '',
    alert.status || '',
    alert.block?.name || '',
    Math.round(alert.calculatedPercentage || 0) + '%',
    alert.message || '',
    alert.resolvedBy?.name || 'Unresolved',
    alert.resolvedAt ? new Date(alert.resolvedAt).toISOString().split('T')[0] : ''
  ]);

  return dataToCSV(headers, rows);
}

/**
 * Generate CSV for complaints
 * 
 * @param {Array} complaintRecords - Populated complaint documents
 * @returns {string} CSV content
 */
function generateComplaintsCSV(complaintRecords = []) {
  const headers = ['Date', 'Category', 'Priority', 'Status', 'Submitted By', 'Assigned To', 'Title', 'Description', 'Resolved Date'];
  
  const rows = complaintRecords.map(complaint => [
    new Date(complaint.createdAt).toISOString().split('T')[0],
    complaint.category || '',
    complaint.priority || '',
    complaint.status || '',
    complaint.user?.name || '',
    complaint.assignedTo?.name || 'Unassigned',
    complaint.title || '',
    complaint.description || '',
    complaint.resolvedAt ? new Date(complaint.resolvedAt).toISOString().split('T')[0] : ''
  ]);

  return dataToCSV(headers, rows);
}

/**
 * Generate CSV for user data
 * 
 * @param {Array} userRecords - User documents
 * @returns {string} CSV content
 */
function generateUsersCSV(userRecords = []) {
  const headers = ['Name', 'Email', 'Role', 'Block', 'Status', 'Department', 'Phone', 'Last Login', 'Created Date'];
  
  const rows = userRecords.map(user => [
    user.name || '',
    user.email || '',
    user.role || '',
    user.block?.name || '',
    user.status || '',
    user.department || '',
    user.phoneNumber || '',
    user.lastLogin ? new Date(user.lastLogin).toISOString() : '',
    new Date(user.createdAt).toISOString().split('T')[0]
  ]);

  return dataToCSV(headers, rows);
}

/**
 * Generate PDF document for usage report
 * Returns a stream for piping to response
 * 
 * @param {Object} options - {title, data, startDate, endDate, generatedBy}
 * @returns {PDFDocument} PDF stream
 */
function generateUsagePDF(options = {}) {
  const { title = 'Usage Report', data = [], startDate, endDate, generatedBy = 'Admin' } = options;
  
  const doc = new PDFDocument({ margin: 40 });
  const now = new Date();

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).font('Helvetica').text(`Generated: ${now.toISOString()}`, { align: 'center' });
  doc.text(`By: ${generatedBy}`, { align: 'center' });
  
  if (startDate || endDate) {
    const dateRange = `Period: ${startDate ? new Date(startDate).toISOString().split('T')[0] : 'N/A'} to ${endDate ? new Date(endDate).toISOString().split('T')[0] : 'N/A'}`;
    doc.text(dateRange, { align: 'center' });
  }
  doc.moveDown();

  // Summary
  doc.fontSize(12).font('Helvetica-Bold').text('Summary', { underline: true });
  doc.fontSize(10).font('Helvetica');
  doc.text(`Total Records: ${data.length}`);
  
  if (Array.isArray(data) && data.length > 0) {
    const resourceTotals = {};
    data.forEach(record => {
      const res = record.resource_type || 'Unknown';
      resourceTotals[res] = (resourceTotals[res] || 0) + (record.usage_value || 0);
    });
    
    doc.moveDown();
    doc.fontSize(10).font('Helvetica-Bold').text('Resource Breakdown:');
    Object.entries(resourceTotals).forEach(([resource, total]) => {
      doc.fontSize(10).text(`  ${resource}: ${Math.round(total * 100) / 100}`);
    });
  }

  doc.moveDown(2);
  doc.fontSize(12).font('Helvetica-Bold').text('Details', { underline: true });
  doc.moveDown();

  // Table header
  const colX = { date: 50, resource: 120, value: 200, unit: 260, block: 320, user: 420 };
  doc.fontSize(9).font('Helvetica-Bold');
  doc.text('Date', colX.date, doc.y);
  doc.text('Resource', colX.resource, doc.y, { width: 80 });
  doc.text('Value', colX.value, doc.y, { width: 60 });
  doc.text('Unit', colX.unit, doc.y, { width: 60 });
  doc.text('Block', colX.block, doc.y, { width: 100 });
  doc.text('User', colX.user, doc.y);
  doc.moveDown();

  // Table rows (limit to 50 for PDF readability)
  doc.fontSize(8).font('Helvetica');
  data.slice(0, 50).forEach(record => {
    const y = doc.y;
    doc.text(new Date(record.usage_date).toISOString().split('T')[0], colX.date);
    doc.text(record.resource_type || '', colX.resource, y, { width: 80 });
    doc.text(String(record.usage_value || 0), colX.value, y, { width: 60 });
    doc.text(record.unit || '', colX.unit, y, { width: 60 });
    doc.text(record.blockId?.name || '', colX.block, y, { width: 100 });
    doc.text(record.userId?.name || '', colX.user, y);
    doc.moveDown(1.2);
  });

  if (data.length > 50) {
    doc.moveDown();
    doc.fontSize(9).text(`... and ${data.length - 50} more records`);
  }

  // Footer
  doc.moveDown(2);
  doc.fontSize(8).text('This is a system-generated report. For verification, contact the administrator.', { align: 'center', color: '#999' });

  doc.end();
  return doc;
}

/**
 * Generate PDF for alert report
 * 
 * @param {Object} options - {title, data, startDate, endDate, generatedBy}
 * @returns {PDFDocument} PDF stream
 */
function generateAlertsPDF(options = {}) {
  const { title = 'Alert Report', data = [], startDate, endDate, generatedBy = 'Admin' } = options;
  
  const doc = new PDFDocument({ margin: 40 });
  const now = new Date();

  // Header
  doc.fontSize(20).font('Helvetica-Bold').text(title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).font('Helvetica').text(`Generated: ${now.toISOString()}`, { align: 'center' });
  doc.text(`By: ${generatedBy}`, { align: 'center' });
  doc.moveDown();

  // Summary
  doc.fontSize(12).font('Helvetica-Bold').text('Summary', { underline: true });
  doc.fontSize(10).font('Helvetica');
  doc.text(`Total Alerts: ${data.length}`);
  
  // Status breakdown
  const statusCounts = {};
  data.forEach(alert => {
    const status = alert.status || 'Unknown';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });
  
  doc.moveDown();
  doc.fontSize(9).font('Helvetica-Bold').text('Status Breakdown:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    doc.fontSize(9).text(`  ${status}: ${count}`);
  });

  doc.moveDown(2);
  doc.fontSize(12).font('Helvetica-Bold').text('Recent Alerts', { underline: true });
  doc.moveDown();

  // List alerts (limit to 20 for readability)
  doc.fontSize(9).font('Helvetica');
  data.slice(0, 20).forEach((alert, idx) => {
    const date = new Date(alert.createdAt).toISOString().split('T')[0];
    doc.fontSize(9).font('Helvetica-Bold').text(`${idx + 1}. [${alert.severity}] ${alert.resourceType} - ${date}`);
    doc.fontSize(8).font('Helvetica')
      .text(`Status: ${alert.status} | Block: ${alert.block?.name || 'N/A'} | Usage: ${Math.round(alert.calculatedPercentage || 0)}%`)
      .text(`Message: ${alert.message}`, { width: 520 });
    doc.moveDown(0.5);
  });

  if (data.length > 20) {
    doc.moveDown();
    doc.fontSize(9).text(`... ${data.length - 20} more alerts`);
  }

  doc.end();
  return doc;
}

module.exports = {
  dataToCSV,
  generateUsageCSV,
  generateAlertsCSV,
  generateComplaintsCSV,
  generateUsersCSV,
  generateUsagePDF,
  generateAlertsPDF
};
