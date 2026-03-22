import { useState, useEffect } from 'react';
import { subscribeAdLogs, type AdLogEntry } from '@/lib/adService';
import { Bug, X } from 'lucide-react';

export default function AdDebugOverlay() {
  const [logs, setLogs] = useState<AdLogEntry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return subscribeAdLogs(setLogs);
  }, []);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-2 z-[9999] bg-black/80 text-white p-2 rounded-full shadow-lg"
        style={{ width: 40, height: 40 }}
      >
        <Bug size={20} />
      </button>
    );
  }

  return (
    <div className="fixed inset-x-2 bottom-16 top-1/3 z-[9999] bg-black/95 text-white rounded-lg border border-white/20 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
        <span className="text-xs font-bold">Ad Debug Logs ({logs.length})</span>
        <button onClick={() => setOpen(false)}><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 text-[10px] font-mono space-y-0.5">
        {logs.length === 0 && <p className="text-white/50">No ad logs yet...</p>}
        {logs.map((l, i) => (
          <div key={i} className={
            l.level === 'error' ? 'text-red-400' :
            l.level === 'warn' ? 'text-yellow-400' : 'text-green-400'
          }>
            <span className="text-white/40">{l.time}</span> {l.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
