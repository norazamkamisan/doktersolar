import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useProject, useSettings } from '../lib/store';
import { readSharePayload, shareFragment, type SharePayload } from '../lib/api';
import ProposalDocument from '../components/ProposalDocument';
import ProposalActions from '../components/ProposalActions';
import { LogoMark } from '../components/Logo';

const HAS_PAYLOAD = /(?:^#|&)[zd]=/;

/**
 * Customer-facing proposal. Loads from this browser's storage when available,
 * otherwise from the data embedded in a share link (#z=… or #d=…).
 */
export default function ProposalView() {
  const { id } = useParams();
  const { hash } = useLocation();
  const local = useProject(id);
  const localSettings = useSettings();
  const docRef = useRef<HTMLElement>(null);
  const [shared, setShared] = useState<SharePayload | null>(null);
  const [loading, setLoading] = useState(() => !local && HAS_PAYLOAD.test(hash));

  // Decode a shared link (decompression is async).
  useEffect(() => {
    if (local) return setLoading(false);
    let alive = true;
    readSharePayload(window.location.hash).then((payload) => {
      if (!alive) return;
      setShared(payload);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [hash, local]);

  // On the installer's own browser, keep the address bar shareable: put the proposal data
  // in the URL so copying it (or the browser's own Share/QR) gives a working link.
  useEffect(() => {
    if (!local) return;
    let alive = true;
    shareFragment(local, localSettings).then((fragment) => {
      if (alive && window.location.hash !== fragment) {
        window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + fragment);
      }
    });
    return () => {
      alive = false;
    };
  }, [local, localSettings]);

  // live data wins on the installer's own browser; customers see the shared snapshot
  const project = local ?? shared?.p;
  const settings = local || !shared ? localSettings : { ...shared.s, logo: null };

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center p-6 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading proposal" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <LogoMark className="h-10 w-10" />
        <p className="font-medium text-slate-800">Proposal not found</p>
        <p className="max-w-sm text-sm text-slate-500">
          This link is incomplete: the part after <code className="rounded bg-slate-100 px-1">#</code> is missing or cut off. Ask
          your installer to send it again using the <strong>Share link</strong> button.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-100 py-4 sm:py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4">
        {local ? (
          <Link to={`/projects/${project.id}/proposal`} className="btn-ghost">
            <ArrowLeft className="h-4 w-4" /> Back to project
          </Link>
        ) : (
          <span />
        )}
        <ProposalActions
          project={project}
          settings={settings}
          documentRef={docRef}
          shareUrl={local ? undefined : window.location.href}
        />
      </div>
      <div className="px-3 sm:px-4 print:px-0">
        <ProposalDocument ref={docRef} project={project} settings={settings} />
      </div>
    </div>
  );
}
