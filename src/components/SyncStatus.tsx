import { AlertTriangle, CloudUpload, CloudOff, HardDrive, Loader2, RefreshCw } from 'lucide-react';
import { syncNow, useSyncStatus } from '../lib/sync';
import { relative } from '../lib/format';

/** Where the data lives and whether this device's changes are saved (sidebar footer). */
export default function SyncStatus() {
  const s = useSyncStatus();
  const pending = s.pendingCount > 0 ? ` ${s.pendingCount} change${s.pendingCount === 1 ? '' : 's'} waiting.` : '';

  const view = {
    connecting: { icon: <Loader2 className="h-4 w-4 animate-spin" />, text: 'Connecting to Google Drive…', tone: 'text-slate-500' },
    local: { icon: <HardDrive className="h-4 w-4" />, text: 'Data is stored in this browser only.', tone: 'text-slate-500' },
    syncing: { icon: <Loader2 className="h-4 w-4 animate-spin" />, text: 'Saving to Google Drive…', tone: 'text-slate-500' },
    saved: {
      icon: <CloudUpload className="h-4 w-4" />,
      text: `Saved to Google Drive${s.savedAt ? ` · ${relative(s.savedAt)}` : ''}`,
      tone: 'text-emerald-700',
    },
    offline: { icon: <CloudOff className="h-4 w-4" />, text: `Offline. Changes are kept on this device.${pending}`, tone: 'text-amber-700' },
    error: { icon: <AlertTriangle className="h-4 w-4" />, text: `Couldn't save to Google Drive.${pending}`, tone: 'text-red-700' },
  }[s.state];

  return (
    <div className={`rounded-lg bg-slate-50 p-3 text-xs ${view.tone}`} role="status" aria-live="polite">
      <div className="flex items-start gap-2">
        <span className="mt-px shrink-0">{view.icon}</span>
        <span>{view.text}</span>
      </div>
      {s.state === 'error' && s.message && <p className="mt-1 text-slate-500">{s.message}</p>}
      {(s.state === 'error' || s.state === 'offline') && (
        <button type="button" onClick={syncNow} className="mt-2 inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      )}
    </div>
  );
}
