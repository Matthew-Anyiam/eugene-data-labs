/**
 * Export utilities for downloading data as CSV or JSON.
 */

type Row = Record<string, string | number | boolean | null | undefined>;

/**
 * Convert an array of objects to CSV string.
 */
export function toCSV(rows: Row[], columns?: { key: string; label: string }[]): string {
  if (rows.length === 0) return '';

  const keys = columns ? columns.map((c) => c.key) : Object.keys(rows[0]);
  const labels = columns ? columns.map((c) => c.label) : keys;

  const escape = (val: unknown): string => {
    const str = val == null ? '' : String(val);
    // Escape quotes and wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = labels.map(escape).join(',');
  const body = rows.map((row) =>
    keys.map((key) => escape(row[key])).join(',')
  ).join('\n');

  return `${header}\n${body}`;
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download data as CSV.
 */
export function downloadCSV(
  rows: Row[],
  filename: string,
  columns?: { key: string; label: string }[]
) {
  const csv = toCSV(rows, columns);
  downloadFile(csv, filename.endsWith('.csv') ? filename : `${filename}.csv`);
}

/**
 * Download data as JSON.
 */
export function downloadJSON(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, filename.endsWith('.json') ? filename : `${filename}.json`, 'application/json');
}
