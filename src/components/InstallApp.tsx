import { useEffect, useState, useSyncExternalStore } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';

/**
 * "Install app" in the sidebar. Chrome / Edge / Android offer their own install prompt; iPhone and
 * iPad Safari have none, so there it shows the Add to Home Screen steps instead. Hidden once the
 * app runs installed, or in browsers that can't install it.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// The browser fires this once, early; keep it for when the button is pressed.
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e as InstallPromptEvent;
  emit();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  emit();
});

const useDeferredPrompt = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => deferred,
  );

const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

// iPhone / iPad (iPadOS reports itself as a Mac with touch)
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

export default function InstallApp() {
  const prompt = useDeferredPrompt();
  const [installed, setInstalled] = useState(isInstalled);
  const [showIos, setShowIos] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia?.('(display-mode: standalone)');
    const update = () => setInstalled(isInstalled());
    mq?.addEventListener?.('change', update);
    return () => mq?.removeEventListener?.('change', update);
  }, []);

  if (installed || (!prompt && !isIos())) return null;

  const install = async () => {
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice.catch(() => undefined);
      deferred = null;
      emit();
    } else {
      setShowIos(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
      >
        <Download className="h-[18px] w-[18px]" />
        Install app
      </button>
      {showIos && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="Install DokterSolar">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold text-slate-900">Install DokterSolar</h2>
              <button type="button" className="btn-ghost !p-1" onClick={() => setShowIos(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ol className="mt-3 space-y-3 text-sm text-slate-700">
              <li className="flex items-center gap-2">
                <span className="font-semibold">1.</span> Tap <Share className="inline h-4 w-4 text-sky-600" aria-label="Share" /> <strong>Share</strong> in Safari's toolbar.
              </li>
              <li className="flex items-center gap-2">
                <span className="font-semibold">2.</span> Choose <SquarePlus className="inline h-4 w-4" aria-hidden="true" /> <strong>Add to Home Screen</strong>.
              </li>
              <li className="flex items-center gap-2">
                <span className="font-semibold">3.</span> Tap <strong>Add</strong>. DokterSolar opens from its icon like an app.
              </li>
            </ol>
            <p className="mt-3 text-xs text-slate-500">Use Safari for this; other iPhone browsers may not offer it.</p>
          </div>
        </div>
      )}
    </>
  );
}
