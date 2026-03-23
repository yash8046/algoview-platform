import type { Trade } from '@/stores/tradingStore';

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function exportTradesToCSV(trades: Trade[], filename = 'trade_history.csv'): void {
  if (trades.length === 0) return;

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

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });

  // Android WebView compatible download
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
