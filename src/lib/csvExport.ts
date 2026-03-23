import type { Trade } from '@/stores/tradingStore';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function buildCSV(trades: Trade[]): string {
  const headers = ['Date', 'Time', 'Symbol', 'Side', 'Price (₹)', 'Quantity', 'Total (₹)', 'P&L (₹)'];
  const rows = trades.map(t => {
    const d = new Date(t.timestamp);
    return [
      d.toLocaleDateString('en-IN'),
      d.toLocaleTimeString('en-IN'),
      escapeCSV(t.symbol),
      t.side.toUpperCase(),
      t.price.toFixed(2),
      t.quantity.toString(),
      t.total.toFixed(2),
      t.pnl !== undefined ? t.pnl.toFixed(2) : '',
    ].join(',');
  });
  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

async function saveNative(csv: string, filename: string): Promise<string> {
  const result = await Filesystem.writeFile({
    path: filename,
    data: csv,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
  });
  return result.uri;
}

function saveBrowser(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

export async function exportTradesToCSV(trades: Trade[], filename = 'trade_history.csv'): Promise<string | void> {
  if (trades.length === 0) return;

  const csv = buildCSV(trades);

  if (Capacitor.isNativePlatform()) {
    const uri = await saveNative(csv, filename);
    return uri;
  } else {
    saveBrowser(csv, filename);
  }
}
