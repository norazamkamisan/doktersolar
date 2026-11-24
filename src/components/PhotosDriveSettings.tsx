import { useEffect, useState } from 'react';
import { CheckCircle2, CloudUpload, Loader2 } from 'lucide-react';
import { pull, usePhotosCloud, useSyncStatus } from '../lib/sync';

/** Settings → Photos in Google Drive: connect the owner's Drive so site visit photos are saved there. */
export default function PhotosDriveSettings() {
  const cloud = usePhotosCloud();
  const sync = useSyncStatus();
  const [busy, setBusy] = useState(false);
  // message from /api/google-callback (?photos=…)
  const [message, setMessage] = useState(() => new URLSearchParams(window.location.search).get('photos') ?? '');

  useEffect(() => {
    if (!message) return;
    // tidy the address bar, and pick up the new connection
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.hash);
    void pull(true);
    if (window.location.hash === '#photos') document.getElementById('photos')?.scrollIntoView({ block: 'start' });
  }, [message]);

  if (sync.state === 'local') return null; // needs the shared Google Drive storage

  const disconnect = async () => {
    if (!confirm('Stop saving site visit photos to Google Drive? Photos already there stay in your Drive.')) return;
    setBusy(true);
    const res = await fetch('/api/google-connect', { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? 'Disconnected. New photos stay on each device.' : body.error || 'Could not disconnect.');
    await pull(true);
    setBusy(false);
  };

  return (
    <section id="photos" className="card space-y-3 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <CloudUpload className="mt-0.5 h-5 w-5 shrink-0 text-brand-500" />
        <div>
          <h2 className="font-semibold text-slate-900">Photos in Google Drive</h2>
          <p className="text-sm text-slate-500">
            Site visit photos upload to a <strong>DokterSolar photos</strong> folder in your Google Drive, one folder per project, and show on every
            device. The app can only see the files it creates there, not the rest of your Drive.
          </p>
        </div>
      </div>

      {message && (
        <p className={`rounded-lg p-3 text-sm ${message === 'connected' ? 'bg-emerald-50 text-emerald-800' : 'border border-amber-200 bg-amber-50 text-amber-800'}`} role="status">
          {message === 'connected' ? 'Connected. Site visit photos will now be saved to Google Drive.' : message}
        </p>
      )}

      {cloud.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
          <p className="flex items-center gap-2 text-sm text-slate-700">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Connected{cloud.email ? <> to <strong>{cloud.email}</strong></> : ''}
          </p>
          <button type="button" className="btn-ghost text-red-600" onClick={disconnect} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <a href="/api/google-connect" className="btn-primary inline-flex">
            Connect Google Drive for photos
          </a>
          <p className="text-xs text-slate-500">
            Sign in with the Google account that owns the DokterSolar data file, and allow access. This needs a Google OAuth client set up in Vercel
            (GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET); see the README.
          </p>
        </div>
      )}
    </section>
  );
}
