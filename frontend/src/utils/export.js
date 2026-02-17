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
                // Handle strings with commas, nulls, etc.
                if (value === null || value === undefined) return '';
                if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
                if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
                return value;
            }).join(',')
        )
    ].join('\n');

    // Create blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
