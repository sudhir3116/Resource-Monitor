/**
 * export.js
 * Utility functions for exporting data in various formats.
 */

export function exportToCSV(data, filename = 'export.csv') {
    if (!data || !data.length) {
        console.warn('No data to export');
        return;
    }

    // Extract headers
    const headers = Object.keys(data[0]);

    // Create CSV content
    const csvContent = [
        headers.join(','),
        ...data.map(row =>
            headers.map(header => {
                const value = row[header];
                if (value === null || value === undefined) return '';
                if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
                if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
                return value;
            }).join(',')
        )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, filename);
}

export function exportToExcel(data, filename = 'export.xlsx') {
    // Note: Creating a proper .xlsx requires a library like XLSX/SheetJS.
    // For now, we use the CSV format with a .xls/.xlsx extension as it's readable by Excel.
    exportToCSV(data, filename);
}

export function exportToJSON(data, filename = 'export.json') {
    if (!data) return;
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    triggerDownload(blob, filename);
}

export function exportToPDF(data, filename = 'export.pdf', title = '') {
    // Note: Creating a proper PDF requires a library like jsPDF.
    // As a fallback, we open a print-friendly view or just log a warning.
    console.warn('PDF Export requires jsPDF library - not fully implemented in vanilla JS');
    alert('PDF Export is currently pending library integration. Downloading CSV instead...');
    exportToCSV(data, filename.replace('.pdf', '.csv'));
}

function triggerDownload(blob, filename) {
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
